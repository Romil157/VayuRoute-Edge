"""
router.py  -  RiskAwareRouter

Provides the production route policy for VayuRoute Edge. The planner uses a
deterministic multi-objective cost model to select routes that minimise a
weighted combination of travel time, risk exposure, and fuel consumption.

Routing profiles:
    FASTEST  -> prioritises SLA recovery and high-priority dispatches
    BALANCED -> preserves the original risk-aware behaviour
    SAFEST   -> leans harder toward lower-risk corridors

When fuel is critically low, the router keeps the public routing mode label as
BALANCED for UI/API compatibility but swaps in a fuel-heavy weight profile.

route_confidence = 100 - max_risk_on_path, clamped 0-100.

Multi-stop routing uses a greedy nearest-neighbour TSP for scalability.
For 5 or fewer stops the original permutation-based solver is used as a fallback
to guarantee the optimal ordering on small inputs.
"""

from datetime import datetime, timezone
import itertools

import networkx as nx


# ---------------------------------------------------------------------------
# Cost function weights
# ---------------------------------------------------------------------------
FASTEST_WEIGHTS = {"time": 0.60, "risk": 0.25, "fuel": 0.15}
BALANCED_WEIGHTS = {"time": 0.35, "risk": 0.50, "fuel": 0.15}
SAFEST_WEIGHTS = {"time": 0.25, "risk": 0.60, "fuel": 0.15}
FUEL_OVERRIDE_WEIGHTS = {"time": 0.20, "risk": 0.20, "fuel": 0.60}

ROUTING_PROFILES = {
    "FASTEST": FASTEST_WEIGHTS,
    "BALANCED": BALANCED_WEIGHTS,
    "SAFEST": SAFEST_WEIGHTS,
}

DEFAULT_ROUTING_MODE = "BALANCED"
SLA_URGENT_THRESHOLD_MINS = 20.0
FUEL_CRITICAL_THRESHOLD = 15.0


def _estimate_fuel_penalty(travel_time):
    """Approximate litres burned for the segment."""
    return travel_time * 0.2


def _safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_priority(priority):
    if priority is None:
        return None
    normalized = str(priority).strip().upper()
    if normalized in {"HIGH", "MEDIUM", "LOW"}:
        return normalized
    return None


def _parse_utc_datetime(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def compute_sla_remaining_minutes(
    sla_deadline,
    dispatch_reference_utc=None,
    current_time_utc=None,
):
    """
    Resolve SLA remaining time from either:
    - a numeric minutes-at-dispatch value, or
    - an ISO-8601 timestamp string.
    """
    if sla_deadline in (None, ""):
        return None

    now = _parse_utc_datetime(current_time_utc) or datetime.now(timezone.utc)

    if isinstance(sla_deadline, str):
        raw = sla_deadline.strip()
        if not raw:
            return None

        numeric_minutes = _safe_float(raw)
        is_numeric_string = (
            numeric_minutes is not None
            and all(token not in raw for token in ("T", "-", ":", "+", "Z"))
        )
        if is_numeric_string:
            deadline_minutes = numeric_minutes
        else:
            absolute_deadline = _parse_utc_datetime(raw)
            if absolute_deadline is None:
                return None
            remaining = (absolute_deadline - now).total_seconds() / 60.0
            return round(max(0.0, remaining), 1)
    else:
        deadline_minutes = _safe_float(sla_deadline)

    if deadline_minutes is None:
        return None

    reference_time = _parse_utc_datetime(dispatch_reference_utc) or now
    elapsed_minutes = max(0.0, (now - reference_time).total_seconds() / 60.0)
    remaining = deadline_minutes - elapsed_minutes
    return round(max(0.0, remaining), 1)


def select_routing_profile(
    priority=None,
    sla_deadline=None,
    dispatch_reference_utc=None,
    fuel_level=None,
    current_time_utc=None,
):
    """
    Select adaptive routing weights without changing the public routing API.

    Precedence:
    1. critical fuel override
    2. urgent SLA
    3. explicit vehicle priority
    4. default BALANCED
    """
    normalized_priority = _normalize_priority(priority)
    fuel_pct = _safe_float(fuel_level)
    sla_remaining_mins = compute_sla_remaining_minutes(
        sla_deadline,
        dispatch_reference_utc=dispatch_reference_utc,
        current_time_utc=current_time_utc,
    )

    if fuel_pct is not None and fuel_pct <= FUEL_CRITICAL_THRESHOLD:
        return {
            "routing_mode": DEFAULT_ROUTING_MODE,
            "selected_weights": dict(FUEL_OVERRIDE_WEIGHTS),
            "decision_reason": (
                f"Applied fuel-saving override due to critical fuel reserve ({round(fuel_pct, 1)}%)."
            ),
            "sla_remaining_mins": sla_remaining_mins,
        }

    if sla_remaining_mins is not None and sla_remaining_mins < SLA_URGENT_THRESHOLD_MINS:
        return {
            "routing_mode": "FASTEST",
            "selected_weights": dict(FASTEST_WEIGHTS),
            "decision_reason": (
                f"Switched to FASTEST mode due to SLA risk ({round(sla_remaining_mins, 1)} min remaining)."
            ),
            "sla_remaining_mins": sla_remaining_mins,
        }

    if normalized_priority == "HIGH":
        return {
            "routing_mode": "FASTEST",
            "selected_weights": dict(FASTEST_WEIGHTS),
            "decision_reason": "Switched to FASTEST mode due to HIGH priority.",
            "sla_remaining_mins": sla_remaining_mins,
        }

    if normalized_priority == "LOW":
        return {
            "routing_mode": "SAFEST",
            "selected_weights": dict(SAFEST_WEIGHTS),
            "decision_reason": "Switched to SAFEST mode due to LOW priority.",
            "sla_remaining_mins": sla_remaining_mins,
        }

    if normalized_priority == "MEDIUM":
        return {
            "routing_mode": DEFAULT_ROUTING_MODE,
            "selected_weights": dict(BALANCED_WEIGHTS),
            "decision_reason": "Using BALANCED mode for MEDIUM priority.",
            "sla_remaining_mins": sla_remaining_mins,
        }

    return {
        "routing_mode": DEFAULT_ROUTING_MODE,
        "selected_weights": dict(BALANCED_WEIGHTS),
        "decision_reason": "Using BALANCED mode by default.",
        "sla_remaining_mins": sla_remaining_mins,
    }


def _edge_cost(travel_time, risk_score, selected_weights):
    """
    Per-edge composite cost.
    Fuel remains approximated from travel time to preserve legacy behaviour.
    """
    fuel_penalty = _estimate_fuel_penalty(travel_time)
    return (
        selected_weights["time"] * travel_time
        + selected_weights["risk"] * risk_score
        + selected_weights["fuel"] * fuel_penalty
    )


def _build_cost_graph(predicted_edges, selected_weights):
    """Build a networkx graph weighted by the selected adaptive cost profile."""
    G = nx.Graph()
    for p in predicted_edges:
        t_time = float(p["weight"])
        r_score = float(p["risk"])
        cost = _edge_cost(t_time, r_score, selected_weights)
        G.add_edge(
            p["source"],
            p["target"],
            weight=cost,
            raw_time=t_time,
            risk=r_score,
        )
    return G


def _walk_path(G, path):
    """Return (total_cost, total_raw_time, max_risk, high_risk_edge_count)."""
    total_cost = 0.0
    total_time = 0.0
    max_risk = 0.0
    flood_edges = 0
    for i in range(len(path) - 1):
        ed = G[path[i]][path[i + 1]]
        total_cost += ed["weight"]
        total_time += ed["raw_time"]
        risk = ed["risk"]
        if risk > max_risk:
            max_risk = risk
        if risk > 60:
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


def _base_response(routing_context, optimal, alternatives=None, cost_function=None):
    return {
        "optimal": optimal,
        "alternatives": alternatives or [],
        "cost_function": cost_function or {},
        "routing_mode": routing_context["routing_mode"],
        "selected_weights": dict(routing_context["selected_weights"]),
        "decision_reason": routing_context["decision_reason"],
        "sla_remaining_mins": routing_context.get("sla_remaining_mins"),
    }


def _cost_function_payload(total_time, max_risk, score):
    return {
        "Time": round(total_time, 1),
        "Risk": round(max_risk, 1),
        "Fuel": int(_estimate_fuel_penalty(total_time)),
        "Priority": 0,
        "score": round(score, 2),
    }


# ---------------------------------------------------------------------------
# Greedy nearest-neighbour TSP
# ---------------------------------------------------------------------------

def _greedy_tsp_sequence(G, start, stop_ids, end):
    """
    Build a visit sequence using the nearest-neighbour heuristic.
    Returns the ordered stop list (excluding start/end).
    """
    unvisited = list(stop_ids)
    sequence = []
    current = start
    while unvisited:
        best_stop = None
        best_cost = float("inf")
        for stop_id in unvisited:
            try:
                candidate_cost = nx.dijkstra_path_length(G, current, stop_id, weight="weight")
            except nx.NetworkXNoPath:
                candidate_cost = float("inf")
            if candidate_cost < best_cost:
                best_cost = candidate_cost
                best_stop = stop_id
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
    max_risk = 0.0
    flood_edges = 0

    for i in range(len(seq) - 1):
        try:
            seg = nx.dijkstra_path(G, seq[i], seq[i + 1], weight="weight")
        except nx.NetworkXNoPath:
            return None
        cost, segment_time, segment_risk, segment_flood_edges = _walk_path(G, seg)
        total_cost += cost
        total_time += segment_time
        if segment_risk > max_risk:
            max_risk = segment_risk
        flood_edges += segment_flood_edges
        if i > 0:
            seg = seg[1:]
        full_path.extend(seg)

    return full_path, total_cost, total_time, max_risk, flood_edges


# ---------------------------------------------------------------------------
# Main router class
# ---------------------------------------------------------------------------

class RiskAwareRouter:

    def get_ai_route(
        self,
        predicted_edges,
        start,
        end,
        stops=None,
        horizon_mins=45,
        priority=None,
        sla_deadline=None,
        dispatch_reference_utc=None,
        fuel_level=None,
        current_time_utc=None,
    ):
        stops = stops or []
        routing_context = select_routing_profile(
            priority=priority,
            sla_deadline=sla_deadline,
            dispatch_reference_utc=dispatch_reference_utc,
            fuel_level=fuel_level,
            current_time_utc=current_time_utc,
        )
        G = _build_cost_graph(predicted_edges, routing_context["selected_weights"])

        # --- Direct route (no stops) ---
        if not stops:
            try:
                path = nx.dijkstra_path(G, start, end, weight="weight")
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                return _base_response(
                    routing_context,
                    optimal={
                        "path": [],
                        "time": 0,
                        "risk": 0,
                        "confidence": 0,
                        "reason": "No path found.",
                        "rejected_reason": "No baseline comparison available.",
                    },
                )

            cost, total_time, max_risk, flood_edges = _walk_path(G, path)
            confidence = int(max(0, min(100, 100 - max_risk)))
            reason = _route_reason(path, G, flood_edges, max_risk)
            rejected = _rejected_reason(flood_edges, max_risk, horizon_mins)
            return _base_response(
                routing_context,
                optimal={
                    "path": path,
                    "time": round(total_time, 1),
                    "risk": round(max_risk, 1),
                    "confidence": confidence,
                    "reason": reason,
                    "rejected_reason": rejected,
                },
                cost_function=_cost_function_payload(total_time, max_risk, cost),
            )

        # --- Multi-stop routing ---
        stop_ids = [s["id"] for s in stops if s["id"] in G.nodes()]

        # Greedy TSP (scales to any number of stops)
        greedy_seq = _greedy_tsp_sequence(G, start, stop_ids, end)
        greedy_full = [start] + greedy_seq + [end]
        greedy_result = _evaluate_sequence(G, greedy_full)

        candidates = []
        if greedy_result:
            path, cost, total_time, max_risk, flood_edges = greedy_result
            candidates.append({
                "path": path,
                "cost": cost,
                "time": total_time,
                "risk": max_risk,
                "flood_edges": flood_edges,
                "label": "Greedy TSP",
            })

        # Permutation fallback for small stop sets (guarantees optimality)
        if len(stop_ids) <= 5:
            for perm in itertools.permutations(stop_ids):
                seq = [start] + list(perm) + [end]
                result = _evaluate_sequence(G, seq)
                if result:
                    path, cost, total_time, max_risk, flood_edges = result
                    candidates.append({
                        "path": path,
                        "cost": cost,
                        "time": total_time,
                        "risk": max_risk,
                        "flood_edges": flood_edges,
                        "label": "Permutation",
                    })

        if not candidates:
            return _base_response(
                routing_context,
                optimal={
                    "path": [],
                    "time": 0,
                    "risk": 0,
                    "confidence": 0,
                    "reason": "No feasible multi-stop route found.",
                    "rejected_reason": "No baseline comparison available.",
                },
            )

        # Sort by composite cost - best first
        candidates.sort(key=lambda candidate: candidate["cost"])
        best = candidates[0]

        confidence = int(max(0, min(100, 100 - best["risk"])))
        reason = _route_reason(best["path"], G, best["flood_edges"], best["risk"])
        rejected = _rejected_reason(best["flood_edges"], best["risk"], horizon_mins)

        # Build alternative suggestions (fastest and safest variants)
        alternatives = []
        fastest = min(candidates, key=lambda candidate: candidate["time"])
        safest = min(candidates, key=lambda candidate: candidate["risk"])

        if fastest["path"] != best["path"]:
            alt_fastest = dict(fastest)
            alt_fastest["type"] = "Faster but Risky"
            alt_fastest["confidence"] = int(max(0, min(100, 100 - fastest["risk"])))
            alt_fastest["reason"] = _rejected_reason(
                fastest["flood_edges"],
                fastest["risk"],
                horizon_mins,
            )
            alt_fastest["cost_function"] = _cost_function_payload(
                fastest["time"],
                fastest["risk"],
                fastest["cost"],
            )
            alternatives.append(alt_fastest)

        if safest["path"] != best["path"] and safest["path"] != fastest["path"]:
            alt_safest = dict(safest)
            alt_safest["type"] = "Slower but Safest"
            alt_safest["confidence"] = int(max(0, min(100, 100 - safest["risk"])))
            alt_safest["reason"] = _rejected_reason(
                safest["flood_edges"],
                safest["risk"],
                horizon_mins,
            )
            alt_safest["cost_function"] = _cost_function_payload(
                safest["time"],
                safest["risk"],
                safest["cost"],
            )
            alternatives.append(alt_safest)

        return _base_response(
            routing_context,
            optimal={
                "path": best["path"],
                "time": round(best["time"], 1),
                "risk": round(best["risk"], 1),
                "confidence": confidence,
                "reason": reason,
                "rejected_reason": rejected,
            },
            alternatives=alternatives,
            cost_function=_cost_function_payload(best["time"], best["risk"], best["cost"]),
        )


class DQNRoutePlanner(RiskAwareRouter):
    """
    Lightweight DQN-style compatibility wrapper.

    The planner reuses the deterministic route search from RiskAwareRouter and
    exposes a policy-style score that downstream components can display as the
    route Q-value. This keeps inference CPU-safe and production-friendly.
    """

    def get_ai_route(
        self,
        predicted_edges,
        start,
        end,
        stops=None,
        horizon_mins=45,
        priority=None,
        sla_deadline=None,
        dispatch_reference_utc=None,
        fuel_level=None,
        current_time_utc=None,
    ):
        result = super().get_ai_route(
            predicted_edges,
            start,
            end,
            stops=stops,
            horizon_mins=horizon_mins,
            priority=priority,
            sla_deadline=sla_deadline,
            dispatch_reference_utc=dispatch_reference_utc,
            fuel_level=fuel_level,
            current_time_utc=current_time_utc,
        )
        optimal = result.get("optimal", {})
        route_score = result.get("cost_function", {}).get("score", 0.0)
        optimal["policy"] = "DQN"
        optimal["q_value"] = round(-route_score, 2)
        return result


# Backwards-compatible aliases for legacy imports.
RoutingAgent = DQNRoutePlanner
