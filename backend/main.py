"""
main.py  —  VayuRoute Edge — FastAPI + WebSocket server

Changes from original:
  - Imports RiskAwareRouter from models.router (replaces dqn.RoutingAgent)
  - Imports get_weather_features from data.weather_feed
  - Adds GET /api/weather endpoint
  - Passes live weather into STGCN each tick
  - Calls graph_mgr.boost_flood_nodes() when rain_intensity > 0.6
  - Adds graph_source field to every WebSocket broadcast
"""
import asyncio
import json
import math
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from data.graph_manager import GraphManager
from data.weather_feed import get_weather_features
from models.stgcn import PredictionService
from models.router import RiskAwareRouter
from simulation.simulator import Simulator

app = FastAPI(title="VayuRoute Edge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

graph_mgr = GraphManager()
stgcn     = PredictionService(num_nodes=18)
router    = RiskAwareRouter()
simulator = Simulator()

active_connections = []


# ---------------------------------------------------------------------------
# Helper — prevents float("inf") and NaN from breaking JSON serialisation
# ---------------------------------------------------------------------------

def _safe(v, default=999):
    if isinstance(v, float) and (math.isinf(v) or math.isnan(v)):
        return default
    return v


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class StopDef(BaseModel):
    id: str
    priority: str
    deadline_mins: int


class RouteRequest(BaseModel):
    start: str
    end:   str
    stops: List[StopDef] = []


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/locations")
async def get_locations():
    return graph_mgr.get_nodes()


@app.get("/api/weather")
async def get_weather():
    return get_weather_features()


@app.post("/set_route")
async def set_route(route: RouteRequest):
    simulator.set_custom_route(route.dict())
    return {"status": "Route injected successfully"}


@app.post("/trigger/{event_type}")
async def trigger_event(event_type: str):
    simulator.trigger_event(event_type)
    return {"status": f"Event {event_type} triggered"}


@app.post("/timeline/{horizon}")
async def set_timeline(horizon: int):
    simulator.trigger_event("timeline", value=horizon)
    return {"status": f"Horizon set to {horizon}"}


# ---------------------------------------------------------------------------
# Main simulation loop  (~2 Hz)
# ---------------------------------------------------------------------------

async def simulation_loop():
    while True:
        try:
            start_time = time.time()
            simulator.step()
            state = simulator.get_state()

            weather = get_weather_features()

            if weather["rain_intensity"] > 0.6:
                graph_mgr.boost_flood_nodes()

            all_selected_nodes = []
            for v in state["vehicles"]:
                all_selected_nodes.append(v["pos"])
                all_selected_nodes.append(v["target"])
                for s in v.get("stops", []):
                    all_selected_nodes.append(s["id"])

            valid_nodes    = graph_mgr.extract_subgraph_nodes(all_selected_nodes)
            subgraph_edges = graph_mgr.extract_subgraph_edges(valid_nodes)

            predicted_edges = stgcn.compute_ai_edge_weights(
                subgraph_edges,
                state["event"],
                state["horizon"],
                weather=weather,
            )

            vehicle_results = []

            for v in state["vehicles"]:
                stops = v.get("stops", [])

                b_path, b_time = graph_mgr.get_baseline_route(
                    v["pos"], v["target"], stops=stops
                )
                b_time = _safe(b_time)

                ai_data = router.get_ai_route(
                    predicted_edges, v["pos"], v["target"],
                    stops=stops,
                    horizon_mins=state["horizon"],
                )

                ai_optimal = ai_data["optimal"]
                ai_path    = ai_optimal["path"]
                ai_time    = _safe(ai_optimal["time"])

                simulator.update_active_path(v["id"], ai_path)

                true_b_time = b_time
                if state["event"] in ("rain", "flood", "heavy_rain"):
                    multiplier  = state["horizon"] / 45.0 if state["horizon"] > 0 else 0.5
                    penalty     = 30 if state["event"] == "flood" else 15
                    true_b_time = _safe(true_b_time + int(penalty * multiplier))

                time_saved = _safe(max(0, true_b_time - ai_time))

                sla_breached     = False
                max_allowed_time = 9999
                if stops:
                    deadlines        = [s.get("deadline_mins", 9999) for s in stops]
                    max_allowed_time = max(deadlines)
                    sla_breached     = true_b_time > max_allowed_time

                rejected_reason = ai_optimal.get("reason", "Suboptimal travel time.")
                if sla_breached:
                    rejected_reason = (
                        f"SLA BREACHED. Route took {true_b_time}m "
                        f"vs allowed {max_allowed_time}m."
                    )

                metrics = state.get("business_metrics", {})
                if metrics and time_saved > 5 and state["horizon"] > 0:
                    if sla_breached:
                        metrics["cost_saved"]            = metrics.get("cost_saved", 0) + 500
                        metrics["sla_breached_baseline"] = metrics.get("sla_breached_baseline", 0) + 1
                    else:
                        metrics["cost_saved"] = metrics.get("cost_saved", 0) + int(time_saved * 15)

                    total_ai       = metrics.get("total_ai_time", 0) + ai_time
                    total_baseline = metrics.get("total_baseline_time", 0) + true_b_time
                    metrics["total_ai_time"]       = total_ai
                    metrics["total_baseline_time"] = total_baseline
                    if total_baseline > 0:
                        metrics["efficiency_percentage"] = round(
                            (1 - total_ai / total_baseline) * 100, 1
                        )

                vehicle_results.append({
                    "id":     v["id"],
                    "pos":    v["pos"],
                    "target": v["target"],
                    "stops":  stops,
                    "fuel":   v.get("fuel", 100),
                    "baseline": {
                        "path":            b_path,
                        "projected_time":  b_time,
                        "true_time":       true_b_time,
                        "rejected_reason": rejected_reason,
                        "sla_breached":    sla_breached,
                    },
                    "ai": {
                        "path":           ai_path,
                        "predicted_time": ai_time,
                        "max_risk":       _safe(ai_optimal["risk"]),
                        "reason":         ai_optimal["reason"],
                        "time_saved":     time_saved,
                        "confidence":     ai_optimal["confidence"],
                        "cost_function":  ai_data["cost_function"],
                        "alternatives":   ai_data["alternatives"],
                    },
                })

            decision_time_ms = round((time.time() - start_time) * 1000, 2)

            payload = {
                "state":           state,
                "latency_ms":      decision_time_ms,
                "vehicles":        vehicle_results,
                "predicted_graph": predicted_edges,
                "nodes":           graph_mgr.get_nodes(),
                "graph_source":    graph_mgr.graph_source,
                "weather":         weather,
            }

            dead = []
            for conn in active_connections:
                try:
                    await conn.send_text(json.dumps(payload))
                except Exception:
                    dead.append(conn)
            for conn in dead:
                if conn in active_connections:
                    active_connections.remove(conn)

        except Exception as e:
            print(f"[simulation_loop ERROR] {e}", flush=True)

        await asyncio.sleep(0.5)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())