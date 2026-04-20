"""
benchmarks/run_evaluation.py

Runs 100 routing scenarios across 5 event conditions and compares
Baseline Dijkstra vs RiskAwareRouter.

Usage (from project root):
    python benchmarks/run_evaluation.py
"""

import sys
import os
import json
import time
import random

# Allow imports from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from data.graph_manager import GraphManager
from models.stgcn import PredictionService
from models.router import RiskAwareRouter

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCENARIOS_PER_CONDITION = 20   # 5 conditions x 20 = 100 total
RANDOM_SEED = 42

EVENT_CONDITIONS = [
    "clear",
    "light_rain",
    "heavy_rain",
    "flood",
    "fuel_critical",
]

WEATHER_MAP = {
    "clear":        {"rain_intensity": 0.0, "wind_factor": 0.0, "is_storm": False},
    "light_rain":   {"rain_intensity": 0.3, "wind_factor": 0.2, "is_storm": False},
    "heavy_rain":   {"rain_intensity": 0.7, "wind_factor": 0.4, "is_storm": False},
    "flood":        {"rain_intensity": 1.0, "wind_factor": 0.6, "is_storm": True},
    "fuel_critical":{"rain_intensity": 0.1, "wind_factor": 0.1, "is_storm": False},
}

# Nodes that carry elevated flood risk in the named graph
FLOOD_NODES = {"G", "I", "H"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def pick_random_pair(node_list, rng):
    a = rng.choice(node_list)
    b = rng.choice(node_list)
    while b == a:
        b = rng.choice(node_list)
    return a, b


def flood_encounters_on_path(path):
    """Count the number of flood-prone nodes visited along a path."""
    return sum(1 for n in path if n in FLOOD_NODES)


def fuel_estimate(route_time_mins):
    """Approximate litres consumed: 0.2 L/min."""
    return round(route_time_mins * 0.2, 2)


def raw_path_time(path, base_edge_map):
    """
    Compute actual travel time (minutes) for a path using base_weight edges.
    The router uses composite cost to SELECT the best path; we report
    real travel minutes here for a fair apples-to-apples comparison.
    """
    total = 0.0
    for i in range(len(path) - 1):
        key = (path[i], path[i + 1])
        total += base_edge_map.get(key, base_edge_map.get((path[i + 1], path[i]), 0.0))
    return round(total, 1)


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def run_benchmark():
    rng = random.Random(RANDOM_SEED)

    graph_mgr = GraphManager()
    stgcn     = PredictionService(num_nodes=18)
    router    = RiskAwareRouter()

    node_list = list(graph_mgr.get_nodes().keys())

    # Pre-build the base_weight lookup for raw travel time measurement
    all_edges = graph_mgr.get_edges()
    base_edge_map = {}
    for e in all_edges:
        base_edge_map[(e["source"], e["target"])] = e["base_weight"]
        base_edge_map[(e["target"], e["source"])] = e["base_weight"]

    results = []

    for condition in EVENT_CONDITIONS:
        weather = WEATHER_MAP[condition]
        horizon = 45

        for _ in range(SCENARIOS_PER_CONDITION):
            start, end = pick_random_pair(node_list, rng)

            subgraph_edges = graph_mgr.get_edges()

            # --- Baseline Dijkstra (pure base_weight, no prediction) ---
            t0 = time.time()
            b_path, b_time = graph_mgr.get_baseline_route(start, end)
            baseline_latency_ms = (time.time() - t0) * 1000
            if b_time == float("inf"):
                b_time = 999.0

            # --- STGCN risk prediction + RiskAwareRouter ---
            t1 = time.time()
            predicted_edges = stgcn.compute_ai_edge_weights(
                subgraph_edges, condition, horizon, weather=weather
            )
            ai_data = router.get_ai_route(predicted_edges, start, end)
            ai_latency_ms = (time.time() - t1) * 1000

            ai_path = ai_data["optimal"]["path"]

            # Report actual travel minutes via base_weight so the comparison
            # is on the same scale as the baseline (both in real minutes)
            ai_actual_time = raw_path_time(ai_path, base_edge_map) if ai_path else float(b_time)

            results.append({
                "condition":           condition,
                "start":               start,
                "end":                 end,
                "baseline_time":       float(b_time),
                "ai_time":             ai_actual_time,
                "baseline_flood":      flood_encounters_on_path(b_path),
                "ai_flood":            flood_encounters_on_path(ai_path),
                "baseline_fuel":       fuel_estimate(float(b_time)),
                "ai_fuel":             fuel_estimate(ai_actual_time),
                "baseline_latency_ms": round(baseline_latency_ms, 2),
                "ai_latency_ms":       round(ai_latency_ms, 2),
            })

    return results


# ---------------------------------------------------------------------------
# Aggregate summary
# ---------------------------------------------------------------------------

def summarise(results):
    n = len(results)
    avg_b_time  = sum(r["baseline_time"] for r in results) / n
    avg_ai_time = sum(r["ai_time"]       for r in results) / n
    total_b_flood  = sum(r["baseline_flood"] for r in results)
    total_ai_flood = sum(r["ai_flood"]       for r in results)
    avg_b_fuel  = sum(r["baseline_fuel"] for r in results) / n
    avg_ai_fuel = sum(r["ai_fuel"]       for r in results) / n
    avg_ai_lat  = sum(r["ai_latency_ms"] for r in results) / n

    delta_time  = round((avg_ai_time - avg_b_time) / max(avg_b_time, 0.01) * 100, 1)
    delta_flood = round((total_ai_flood - total_b_flood) / max(total_b_flood, 1) * 100, 1)
    delta_fuel  = round((avg_ai_fuel - avg_b_fuel) / max(avg_b_fuel, 0.01) * 100, 1)

    return {
        "total_scenarios":      n,
        "avg_baseline_time":    round(avg_b_time, 1),
        "avg_ai_time":          round(avg_ai_time, 1),
        "delta_time_pct":       delta_time,
        "baseline_flood_total": total_b_flood,
        "ai_flood_total":       total_ai_flood,
        "delta_flood_pct":      delta_flood,
        "avg_baseline_fuel":    round(avg_b_fuel, 2),
        "avg_ai_fuel":          round(avg_ai_fuel, 2),
        "delta_fuel_pct":       delta_fuel,
        "avg_ai_latency_ms":    round(avg_ai_lat, 2),
    }


# ---------------------------------------------------------------------------
# Results table
# ---------------------------------------------------------------------------

def print_table(summary):
    n  = summary["total_scenarios"]
    bf = summary["baseline_flood_total"]
    af = summary["ai_flood_total"]

    rows = [
        ("Avg route time (min)",
         str(summary["avg_baseline_time"]),
         str(summary["avg_ai_time"]),
         f"{summary['delta_time_pct']:+.1f}%"),
        ("Flood encounters",
         f"{bf}/{n}",
         f"{af}/{n}",
         f"{summary['delta_flood_pct']:+.1f}%"),
        ("Fuel wasted (L avg)",
         str(summary["avg_baseline_fuel"]),
         str(summary["avg_ai_fuel"]),
         f"{summary['delta_fuel_pct']:+.1f}%"),
        ("Decision latency ms",
         "-",
         f"<{summary['avg_ai_latency_ms']:.0f} ms",
         "edge"),
    ]

    col_w = [24, 12, 14, 9]
    header = ("Metric", "Baseline", "VayuRoute AI", "Delta")
    sep    = "-+-".join("-" * w for w in col_w)

    def fmt_row(cells):
        return "  |  ".join(str(c).ljust(w) for c, w in zip(cells, col_w))

    print()
    print(fmt_row(header))
    print(sep)
    for row in rows:
        print(fmt_row(row))
    print()


def build_results_md(summary):
    n  = summary["total_scenarios"]
    bf = summary["baseline_flood_total"]
    af = summary["ai_flood_total"]
    dt = f"{summary['delta_time_pct']:+.1f}%"
    df = f"{summary['delta_flood_pct']:+.1f}%"
    du = f"{summary['delta_fuel_pct']:+.1f}%"

    return f"""# VayuRoute Benchmark Results

Scenarios: {n} (20 per condition x 5 conditions: clear, light_rain, heavy_rain, flood, fuel_critical)
Graph: Mumbai Andheri-Kurla corridor (18 named nodes)
Router: RiskAwareRouter — cost = 0.50*time + 0.35*risk + 0.15*fuel
Note: AI route times reported in real travel minutes (base_weight) for fair comparison with baseline.

| Metric               | Baseline               | VayuRoute AI                         | Delta   |
|----------------------|------------------------|--------------------------------------|---------|
| Avg route time (min) | {summary['avg_baseline_time']:<22} | {summary['avg_ai_time']:<36} | {dt:<7} |
| Flood encounters     | {bf}/{n:<20} | {af}/{n:<36} | {df:<7} |
| Fuel wasted (L avg)  | {summary['avg_baseline_fuel']:<22} | {summary['avg_ai_fuel']:<36} | {du:<7} |
| Decision latency ms  | -                      | under {summary['avg_ai_latency_ms']:.0f} ms                         | edge    |
"""


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("[Benchmarks] Starting evaluation — 100 scenarios across 5 conditions...")
    results = run_benchmark()
    summary = summarise(results)

    out_dir   = os.path.dirname(__file__)
    json_path = os.path.join(out_dir, "results.json")
    md_path   = os.path.join(out_dir, "RESULTS.md")

    with open(json_path, "w") as f:
        json.dump({"summary": summary, "scenarios": results}, f, indent=2)
    print(f"[Benchmarks] Results saved to {json_path}")

    md_content = build_results_md(summary)
    with open(md_path, "w") as f:
        f.write(md_content)
    print(f"[Benchmarks] Results table saved to {md_path}")

    print_table(summary)
    print("[Benchmarks] Evaluation complete.")
