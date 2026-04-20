"""
stgcn.py  —  Spatio-Temporal Graph Convolutional Network (2-layer)

Architecture:
    Layer 1 (Spatial):  nn.Linear over node features weighted by adjacency matrix
    Layer 2 (Temporal): nn.Conv1d over a 5-step sliding time window
    Output head:        per-node (predicted_cost, risk_score) for the given horizon

Input feature vector per node (5 dimensions):
    [base_weight_normalised, current_risk, rain_intensity, wind_factor, is_storm]

Weight initialisation: Xavier uniform on all Linear and Conv1d weight tensors.
Hidden dimension: 16 (fixed).
"""

import os
import sys
import time
import torch
import torch.nn as nn
import torch.nn.functional as F

HIDDEN_DIM   = 16
IN_FEATURES  = 5    # [base_weight, current_risk, rain_intensity, wind_factor, is_storm]
TIME_STEPS   = 5    # temporal window length
OUT_FEATURES = 2    # [predicted_cost, risk_score]
MAX_INFERENCE_MS = 300


# ---------------------------------------------------------------------------
# Model definition
# ---------------------------------------------------------------------------

class STGCN_Layer(nn.Module):
    """
    One spatio-temporal block:
        1) Spatial graph convolution:  H = ReLU( A_norm * X * W_spatial )
        2) Temporal 1D convolution:    H = ReLU( Conv1d(H, kernel=TIME_STEPS) )
    """

    def __init__(self, in_features, hidden_dim, time_steps):
        super().__init__()
        self.spatial_fc   = nn.Linear(in_features, hidden_dim)
        # Temporal convolution along the time axis
        # in_channels = hidden_dim, kernel covers time_steps positions
        self.temporal_conv = nn.Conv1d(
            in_channels=hidden_dim,
            out_channels=hidden_dim,
            kernel_size=time_steps,
            padding=time_steps // 2,
        )

    def forward(self, x, adj_norm):
        """
        x:        (batch, num_nodes, in_features)
        adj_norm: (num_nodes, num_nodes) normalised adjacency
        Returns:  (batch, num_nodes, hidden_dim)
        """
        # Spatial: aggregate neighbour features
        spatial = torch.bmm(adj_norm.unsqueeze(0).expand(x.size(0), -1, -1), x)
        spatial = F.relu(self.spatial_fc(spatial))          # (B, N, H)

        # Temporal: treat (B, H, N) as (batch, channels, length)
        temp = spatial.permute(0, 2, 1)                     # (B, H, N)
        temp = F.relu(self.temporal_conv(temp))             # (B, H, N)
        out  = temp.permute(0, 2, 1)                        # (B, N, H)
        return out


class STGCN_Predictor(nn.Module):
    def __init__(self, num_nodes, in_features=IN_FEATURES, hidden_dim=HIDDEN_DIM):
        super().__init__()
        self.layer1      = STGCN_Layer(in_features, hidden_dim, TIME_STEPS)
        self.layer2      = STGCN_Layer(hidden_dim,  hidden_dim, TIME_STEPS)
        self.output_head = nn.Linear(hidden_dim, OUT_FEATURES)
        self._init_weights()

    def _init_weights(self):
        """Xavier uniform initialisation on all weight tensors."""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.Conv1d):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, x, adj_norm):
        h = self.layer1(x, adj_norm)
        h = self.layer2(h, adj_norm)
        return self.output_head(h)


# ---------------------------------------------------------------------------
# Prediction service
# ---------------------------------------------------------------------------

class PredictionService:
    def __init__(self, num_nodes=18):
        self.num_nodes = num_nodes
        self.model = STGCN_Predictor(num_nodes=num_nodes)
        self.model.eval()

        # Sanity check: model must be small enough for edge deployment
        param_count = sum(p.numel() for p in self.model.parameters())
        assert param_count < 500_000, "Model too large for edge deployment"
        size_mb = param_count * 4 / (1024 ** 2)
        print(f"[STGCN] Parameters: {param_count:,}  |  Estimated size: {size_mb:.3f} MB")

        # Verify inference latency on CPU
        self._verify_latency()

        # Export TorchScript
        self._export_torchscript()

    def _verify_latency(self):
        """Assert that a single forward pass completes in under 300 ms on CPU."""
        dummy_x   = torch.zeros(1, self.num_nodes, IN_FEATURES)
        dummy_adj = torch.eye(self.num_nodes)
        with torch.no_grad():
            t0 = time.time()
            _ = self.model(dummy_x, dummy_adj)
            elapsed_ms = (time.time() - t0) * 1000
        assert elapsed_ms < MAX_INFERENCE_MS, (
            f"STGCN inference took {elapsed_ms:.1f} ms — exceeds {MAX_INFERENCE_MS} ms limit."
        )
        print(f"[STGCN] Inference latency: {elapsed_ms:.1f} ms (limit: {MAX_INFERENCE_MS} ms).")

    def _export_torchscript(self):
        try:
            out_dir  = os.path.join(os.path.dirname(__file__))
            out_path = os.path.join(out_dir, "stgcn_edge.pt")
            scripted = torch.jit.script(self.model)
            torch.jit.save(scripted, out_path)
            size_mb  = os.path.getsize(out_path) / (1024 ** 2)
            print(f"[STGCN] TorchScript exported to {out_path}  ({size_mb:.2f} MB).")
        except Exception as exc:
            print(f"[STGCN] TorchScript export skipped: {exc}")

    # ------------------------------------------------------------------
    # Normalised adjacency helper
    # ------------------------------------------------------------------

    def _build_adj(self, node_ids, edges):
        """
        Build a row-normalised adjacency matrix for the given node set.
        """
        idx = {n: i for i, n in enumerate(node_ids)}
        N   = len(node_ids)
        adj = torch.zeros(N, N)
        for e in edges:
            if e["source"] in idx and e["target"] in idx:
                i, j = idx[e["source"]], idx[e["target"]]
                adj[i, j] = 1.0
                adj[j, i] = 1.0
        # Add self-loops and row-normalise
        adj += torch.eye(N)
        row_sum = adj.sum(dim=1, keepdim=True).clamp(min=1.0)
        return adj / row_sum

    # ------------------------------------------------------------------
    # Main entry point called from the simulation loop
    # ------------------------------------------------------------------

    def compute_ai_edge_weights(self, graph_edges, event_state, horizon_mins,
                                weather=None):
        """
        Compute predicted (weight, risk) for each edge.

        weather: dict with keys rain_intensity, wind_factor, is_storm
                 (from weather_feed.get_weather_features())
        """
        weather = weather or {"rain_intensity": 0.0, "wind_factor": 0.0, "is_storm": False}

        multiplier = horizon_mins / 45.0

        # Collect unique node IDs from the edge list
        node_set = set()
        for e in graph_edges:
            node_set.add(e["source"])
            node_set.add(e["target"])
        node_ids = sorted(node_set)
        N = len(node_ids)

        if N == 0:
            return graph_edges

        idx = {n: i for i, n in enumerate(node_ids)}

        # Build node feature matrix: [base_weight, risk, rain, wind, is_storm]
        x = torch.zeros(1, N, IN_FEATURES)
        for e in graph_edges:
            for node in (e["source"], e["target"]):
                if node in idx:
                    i = idx[node]
                    x[0, i, 0] = float(e["base_weight"]) / 30.0  # normalise
                    x[0, i, 1] = float(e["risk"])        / 100.0
                    x[0, i, 2] = float(weather["rain_intensity"])
                    x[0, i, 3] = float(weather["wind_factor"])
                    x[0, i, 4] = 1.0 if weather["is_storm"] else 0.0

        adj_norm = self._build_adj(node_ids, graph_edges)

        with torch.no_grad():
            out = self.model(x, adj_norm)   # (1, N, 2)

        # out[:, :, 0] -> predicted cost delta
        # out[:, :, 1] -> predicted risk delta
        pred_cost = out[0, :, 0].numpy()
        pred_risk = out[0, :, 1].numpy()

        predicted_edges = []
        for e in graph_edges:
            si = idx.get(e["source"], 0)
            ti = idx.get(e["target"], 0)

            # Average per-node predictions to get per-edge values
            node_cost_delta = float((pred_cost[si] + pred_cost[ti]) / 2.0)
            node_risk_delta = float((pred_risk[si] + pred_risk[ti]) / 2.0)

            p_weight = e["base_weight"]
            p_risk   = 0.0

            # Rule-based overlay (deterministic, event-aware)
            if event_state in ("rain", "light_rain"):
                p_risk   = 35.0 * multiplier
                p_weight = e["base_weight"] + 5.0 * multiplier
            elif event_state == "heavy_rain":
                p_risk   = 60.0 * multiplier
                p_weight = e["base_weight"] + 12.0 * multiplier
            elif event_state == "flood":
                p_risk   = 85.0 * multiplier
                p_weight = e["base_weight"] + 20.0 * multiplier

            # Blend STGCN deltas (clamped to avoid negative weights)
            p_weight = max(1.0, p_weight + node_cost_delta * multiplier)
            p_risk   = max(0.0, min(100.0, p_risk + node_risk_delta * multiplier))

            # Weather boost on top
            if weather["rain_intensity"] > 0.6:
                p_risk   = min(100.0, p_risk + weather["rain_intensity"] * 20.0)
                p_weight = p_weight + weather["rain_intensity"] * 5.0

            predicted_edges.append({
                "source": e["source"],
                "target": e["target"],
                "weight": round(p_weight, 2),
                "risk":   round(p_risk, 2),
            })

        return predicted_edges
