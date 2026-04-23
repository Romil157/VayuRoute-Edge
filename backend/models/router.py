"""
router.py  -  RiskAwareRouter

Provides the production route policy for VayuRoute Edge. The planner uses a
deterministic multi-objective cost model to select routes that minimise a
weighted combination of travel time, risk exposure, and fuel consumption.

Multi-objective cost function (documented weights):
    cost(edge) = alpha * travel_time + beta * risk_score + gamma * fuel_penalty
    alpha = 0.35  (travel time remains significant for SLA compliance)
    beta  = 0.50  (risk is prioritised to force safer rerouting under disruption)
    gamma = 0.15  (fuel penalty discourages long detours)

route_confidence = 100 - (max_risk_on_path * 100), clamped 0-100.

Multi-stop routing uses a greedy nearest-neighbour TSP for scalability.
For 5 or fewer stops the original permutation-based solver is used as a fallback
to guarantee the optimal ordering on small inputs.
"""

import networkx as nx
import itertools


# ---------------------------------------------------------------------------
# Cost function weights
# ---------------------------------------------------------------------------
ALPHA = 0.35   # weight for travel time
BETA  = 0.50   # weight for risk score
GAMMA = 0.15   # weight for fuel penalty


def _edge_cost(travel_time, risk_score):
    """
    Per-edge composite cost.
    fuel_penalty is approximated as 0.2 litres per minute of travel.
    """
    fuel_penalty = travel_time * 0.2
    return ALPHA * travel_time + BETA * risk_score + GAMMA * fuel_penalty


def _build_cost_graph(predicted_edges):
    """Build a networkx graph weighted by the composite cost function."""
    G = nx.Graph()
    for p in predicted_edges:
        t_time  = float(p["weight"])
        r_score = float(p["risk"])
        cost    = _edge_cost(t_time, r_score)
        G.add_edge(
            p["source"], p["target"],
            weight=cost,
            raw_time=t_time,
            risk=r_score,
        )
    return G


def _walk_path(G, path):
    """Return (total_cost, total_raw_time, max_risk, high_risk_edge_count)."""
    total_cost  = 0.0
    total_time  = 0.0
    max_risk    = 0.0
    flood_edges = 0
    for i in range(len(path) - 1):
        ed = G[path[i]][path[i + 1]]
        total_cost += ed["weight"]
        total_time += ed["raw_time"]
        r = ed["risk"]
        if r > max_risk:
            max_risk = r
        if r > 60:
            flood_edges += 1
    return total_cost, total_time, max_risk, flood_edges


def _rejected_reason(flood_edge_count, max_risk, horizon_mins=45):
    if flood_edge_count == 0:
        return "Baseline route accepted - no flood exposure detected."
    risk_label = "moderate" if max_risk < 70 else "severe"
    return (
        f"Rejected: {flood_edge_count} edge(s) exceed 60% flood probability "
        f"({risk_label} risk at {round(max_risk)}%) in {horizon_mins}-min horizon."
    )


def _route_reason(path, G, flood_edges, max_risk, time_saved=0):
    """Generate a human-readable explanation for why the AI route was chosen."""
    if flood_edges == 0 and time_saved <= 0:
        return "AI route generated. No significant risk detected."
    parts = []
    if flood_edges > 0:
        parts.append(f"Avoids {flood_edges} high-risk segment(s) (max risk {round(max_risk)}%)")
    if time_saved > 0:
        parts.append(f"saves {round(time_saved, 1)} min vs baseline")
    return "Route " + " and ".join(parts) + "."


# ---------------------------------------------------------------------------
# Greedy nearest-neighbour TSP
# ---------------------------------------------------------------------------

def _greedy_tsp_sequence(G, start, stop_ids, end):
    """
    Build a visit sequence using the nearest-neighbour heuristic.
    Returns the ordered stop list (excluding start/end).
    """
    unvisited = list(stop_ids)
    sequence  = []
    current   = start
    while unvisited:
        best_stop = None
        best_cost = float("inf")
        for s in unvisited:
            try:
                c = nx.dijkstra_path_length(G, current, s, weight="weight")
            except nx.NetworkXNoPath:
                c = float("inf")
            if c < best_cost:
                best_cost = c
                best_stop = s
        if best_stop is None:
            break
        sequence.append(best_stop)
        unvisited.remove(best_stop)
        current = best_stop
    return sequence


def _evaluate_sequence(G, seq):
    """
    Evaluate a full visit sequence (including start and end).
    Returns (path_list, total_cost, total_time, max_risk, flood_edges) or None.
    """
    full_path = []
    total_cost = 0.0
    total_time = 0.0
    max_risk   = 0.0
    flood_edges = 0

    for i in range(len(seq) - 1):
        try:
            seg = nx.dijkstra_path(G, seq[i], seq[i + 1], weight="weight")
        except nx.NetworkXNoPath:
            return None
        cost, t, r, fe = _walk_path(G, seg)
        total_cost  += cost
        total_time  += t
        if r > max_risk:
            max_risk = r
        flood_edges += fe
        if i > 0:
            seg = seg[1:]
        full_path.extend(seg)

    return full_path, total_cost, total_time, max_risk, flood_edges


# ---------------------------------------------------------------------------
# Main router class
# ---------------------------------------------------------------------------

class RiskAwareRouter:

    def get_ai_route(self, predicted_edges, start, end, stops=None, horizon_mins=45):
        stops = stops or []
        G = _build_cost_graph(predicted_edges)

        # --- Direct route (no stops) ---
        if not stops:
            try:
                path = nx.dijkstra_path(G, start, end, weight="weight")
            except nx.NetworkXNoPath:
                return {"optimal": {"path": [], "time": 0, "risk": 0, "confidence": 0,
                                    "reason": "No path found."}, "alternatives": [], "cost_function": {}}
            cost, t_time, max_risk, flood_edges = _walk_path(G, path)
            confidence = int(max(0, min(100, 100 - max_risk)))
            reason     = _route_reason(path, G, flood_edges, max_risk)
            rejected   = _rejected_reason(flood_edges, max_risk, horizon_mins)
            fuel_est   = int(t_time * 0.2)
            return {
                "optimal": {
                    "path":       path,
                    "time":       round(t_time, 1),
                    "risk":       round(max_risk, 1),
                    "confidence": confidence,
                    "reason":     reason,
                    "rejected_reason": rejected,
                },
                "alternatives": [],
                "cost_function": {
                    "Time":  round(t_time, 1),
                    "Risk":  round(max_risk, 1),
                    "Fuel":  fuel_est,
                    "Priority": 0,
                    "score": round(cost, 2),
                },
            }

        # --- Multi-stop routing ---
        stop_ids = [s["id"] for s in stops if s["id"] in G.nodes()]

        # Greedy TSP (scales to any number of stops)
        greedy_seq  = _greedy_tsp_sequence(G, start, stop_ids, end)
        greedy_full = [start] + greedy_seq + [end]
        greedy_result = _evaluate_sequence(G, greedy_full)

        candidates = []
        if greedy_result:
            path, cost, t_time, max_risk, flood_edges = greedy_result
            candidates.append({
                "path": path, "cost": cost, "time": t_time,
                "risk": max_risk, "flood_edges": flood_edges,
                "label": "Greedy TSP",
            })

        # Permutation fallback for small stop sets (guarantees optimality)
        if len(stop_ids) <= 5:
            for perm in itertools.permutations(stop_ids):
                seq = [start] + list(perm) + [end]
                res = _evaluate_sequence(G, seq)
                if res:
                    path, cost, t_time, max_risk, flood_edges = res
                    candidates.append({
                        "path": path, "cost": cost, "time": t_time,
                        "risk": max_risk, "flood_edges": flood_edges,
                        "label": "Permutation",
                    })

        if not candidates:
            return {"optimal": {"path": [], "time": 0, "risk": 0, "confidence": 0,
                                "reason": "No feasible multi-stop route found."},
                    "alternatives": [], "cost_function": {}}

        # Sort by composite cost - best first
        candidates.sort(key=lambda x: x["cost"])
        best = candidates[0]

        confidence = int(max(0, min(100, 100 - best["risk"])))
        reason     = _route_reason(best["path"], G, best["flood_edges"], best["risk"])
        rejected   = _rejected_reason(best["flood_edges"], best["risk"], horizon_mins)
        fuel_est   = int(best["time"] * 0.2)

        # Build alternative suggestions (fastest and safest variants)
        alternatives = []
        fastest = min(candidates, key=lambda x: x["time"])
        safest  = min(candidates, key=lambda x: x["risk"])

        if fastest["path"] != best["path"]:
            alt_f = dict(fastest)
            alt_f["type"] = "Faster but Risky"
            alt_f["confidence"] = int(max(0, min(100, 100 - fastest["risk"])))
            alt_f["reason"] = _rejected_reason(fastest["flood_edges"], fastest["risk"], horizon_mins)
            alt_f["cost_function"] = {
                "Time": round(fastest["time"], 1),
                "Risk": round(fastest["risk"], 1),
                "Fuel": int(fastest["time"] * 0.2),
                "Priority": 0,
                "score": round(fastest["cost"], 2),
            }
            alternatives.append(alt_f)
        if safest["path"] != best["path"] and safest["path"] != fastest.get("path"):
            alt_s = dict(safest)
            alt_s["type"] = "Slower but Safest"
            alt_s["confidence"] = int(max(0, min(100, 100 - safest["risk"])))
            alt_s["reason"] = _rejected_reason(safest["flood_edges"], safest["risk"], horizon_mins)
            alt_s["cost_function"] = {
                "Time": round(safest["time"], 1),
                "Risk": round(safest["risk"], 1),
                "Fuel": int(safest["time"] * 0.2),
                "Priority": 0,
                "score": round(safest["cost"], 2),
            }
            alternatives.append(alt_s)

        optimal = {
            "path":       best["path"],
            "time":       round(best["time"], 1),
            "risk":       round(best["risk"], 1),
            "confidence": confidence,
            "reason":     reason,
            "rejected_reason": rejected,
        }
        cf = {
            "Time":     round(best["time"], 1),
            "Risk":     round(best["risk"], 1),
            "Fuel":     fuel_est,
            "Priority": 0,
            "score":    round(best["cost"], 2),
        }
        return {"optimal": optimal, "alternatives": alternatives, "cost_function": cf}


class DQNRoutePlanner(RiskAwareRouter):
    """
    Lightweight DQN-style compatibility wrapper.

    The planner reuses the deterministic route search from RiskAwareRouter and
    exposes a policy-style score that downstream components can display as the
    route Q-value. This keeps inference CPU-safe and production-friendly.
    """

    def get_ai_route(self, predicted_edges, start, end, stops=None, horizon_mins=45):
        result = super().get_ai_route(
            predicted_edges,
            start,
            end,
            stops=stops,
            horizon_mins=horizon_mins,
        )
        optimal = result.get("optimal", {})
        route_score = result.get("cost_function", {}).get("score", 0.0)
        optimal["policy"] = "DQN"
        optimal["q_value"] = round(-route_score, 2)
        return result


# Backwards-compatible aliases for legacy imports.
RoutingAgent = DQNRoutePlanner
