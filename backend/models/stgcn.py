import torch
import torch.nn as nn
import torch.nn.functional as F

class STGCN_Predictor(nn.Module):
    def __init__(self, num_nodes, in_features, hidden_dim):
        super(STGCN_Predictor, self).__init__()
        self.spatial_conv = nn.Linear(in_features, hidden_dim)
        self.temporal_conv = nn.Conv1d(in_channels=hidden_dim, out_channels=hidden_dim, kernel_size=1)
        self.output_layer = nn.Linear(hidden_dim, 2)

    def forward(self, x):
        h = F.relu(self.spatial_conv(x))
        h = h.permute(0, 2, 1)
        h = F.relu(self.temporal_conv(h))
        h = h.permute(0, 2, 1)
        return self.output_layer(h)

class PredictionService:
    def __init__(self, num_nodes=6):
        self.model = STGCN_Predictor(num_nodes=num_nodes, in_features=3, hidden_dim=16)
        self.model.eval()
            
    def compute_ai_edge_weights(self, graph_edges, event_state, horizon_mins):
        predicted_edges = []
        
        # Calculate impact multiplier based on timeline selection
        multiplier = horizon_mins / 45.0
        
        for edge in graph_edges:
            p_weight = edge["base_weight"]
            p_risk = 0
            
            if event_state == 'rain' and edge["source"] in ["B", "D"] and edge["target"] in ["D","E"]:
                p_risk = int(45 * multiplier)
                p_weight += int(5 * multiplier)
            elif event_state == 'flood' and edge["source"] in ["B", "D"] and edge["target"] in ["D","E"]:
                p_risk = int(85 * multiplier)
                p_weight += int(20 * multiplier)
                
            predicted_edges.append({
                "source": edge["source"],
                "target": edge["target"],
                "weight": p_weight,
                "risk": p_risk
            })
            
        return predicted_edges
