import asyncio
import json
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from data.graph_manager import GraphManager
from models.stgcn import PredictionService
from models.dqn import RoutingAgent
from simulation.simulator import Simulator

app = FastAPI(title="VayuRoute Edge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

graph_mgr = GraphManager()
stgcn = PredictionService(num_nodes=18)
dqn = RoutingAgent()
simulator = Simulator()

active_connections = []

class StopDef(BaseModel):
    id: str
    priority: str
    deadline_mins: int

class RouteRequest(BaseModel):
    start: str
    end: str
    stops: List[StopDef] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

@app.get("/locations")
async def get_locations():
    return graph_mgr.get_nodes()

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

async def simulation_loop():
    while True:
        start_time = time.time()
        simulator.step()
        state = simulator.get_state()
        
        all_selected_nodes = []
        for v in state["vehicles"]:
            all_selected_nodes.append(v["pos"])
            all_selected_nodes.append(v["target"])
            for s in v["stops"]:
                all_selected_nodes.append(s["id"])
                
        valid_nodes = graph_mgr.extract_subgraph_nodes(all_selected_nodes)
        subgraph_edges = graph_mgr.extract_subgraph_edges(valid_nodes)
        
        predicted_edges = stgcn.compute_ai_edge_weights(subgraph_edges, state["event"], state["horizon"])
        
        vehicle_results = []
        
        for v in state["vehicles"]:
            b_path, b_time = graph_mgr.get_baseline_route(v["pos"], v["target"], stops=v["stops"])
            ai_data = dqn.get_ai_route(predicted_edges, v["pos"], v["target"], stops=v["stops"])
            
            ai_optimal = ai_data["optimal"]
            ai_path = ai_optimal["path"]
            ai_time = ai_optimal["time"]
            
            # Sync simulator with the path to move the vehicle
            simulator.update_active_path(v["id"], ai_path)
            
            true_b_time = b_time
            if state["event"] in ['rain', 'flood'] and 'H' in b_path and 'K' in b_path:
                multiplier = state["horizon"] / 45.0
                true_b_time += int((30 if state["event"] == 'flood' else 15) * multiplier)
                
            time_saved = true_b_time - ai_time if (true_b_time - ai_time) > 0 else 0
            
            max_allowed_time = float('inf')
            if v["stops"]:
                max_allowed_time = max([s["deadline_mins"] for s in v["stops"]])
                
            sla_breached = true_b_time > max_allowed_time
            
            rejected_reason = "Suboptimal travel time calculated."
            if sla_breached:
                 rejected_reason = f"DELIVERY FAILED / SLA BREACHED. Route took {true_b_time}m vs allowed {max_allowed_time}m."

            # Update metrics
            if time_saved > 5 and state["horizon"] > 0:
                if sla_breached:
                    state["business_metrics"]["cost_saved"] += 500
                    state["business_metrics"]["sla_breached_baseline"] += 1
                else:
                    state["business_metrics"]["cost_saved"] += int(time_saved * 15)
            
            vehicle_results.append({
                "id": v["id"],
                "pos": v["pos"],
                "target": v["target"],
                "stops": v["stops"],
                "fuel": v["fuel"],
                "baseline": {
                    "path": b_path,
                    "projected_time": b_time,
                    "true_time": true_b_time,
                    "rejected_reason": rejected_reason,
                    "sla_breached": sla_breached
                },
                "ai": {
                    "path": ai_path,
                    "predicted_time": ai_time,
                    "max_risk": ai_optimal["risk"],
                    "reason": ai_optimal["reason"],
                    "time_saved": time_saved,
                    "confidence": ai_optimal["confidence"],
                    "cost_function": ai_data["cost_function"],
                    "alternatives": ai_data["alternatives"]
                }
            })

        decision_time_ms = round((time.time() - start_time) * 1000, 2)
        payload = {
            "state": state,
            "latency_ms": decision_time_ms,
            "vehicles": vehicle_results,
            "predicted_graph": predicted_edges,
            "nodes": graph_mgr.get_nodes()
        }
        
        for conn in active_connections:
            try:
                await conn.send_text(json.dumps(payload))
            except Exception:
                pass
            
        await asyncio.sleep(0.5)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())
