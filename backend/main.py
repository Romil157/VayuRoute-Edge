import asyncio
import contextlib
import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


if __package__ in (None, ""):
    project_root = Path(__file__).resolve().parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    from backend.schemas import FleetDispatchRequest, RouteRequest
    from backend.services.platform import LogisticsIntelligencePlatform
else:
    from .schemas import FleetDispatchRequest, RouteRequest
    from .services.platform import LogisticsIntelligencePlatform


platform = LogisticsIntelligencePlatform()
active_connections = []


async def simulation_loop():
    while True:
        try:
            payload = platform.tick()
            if payload is None:
                await asyncio.sleep(0.05)
                continue

            dead_connections = []

            for connection in active_connections:
                try:
                    await connection.send_text(json.dumps(payload))
                except Exception:
                    dead_connections.append(connection)

            for connection in dead_connections:
                if connection in active_connections:
                    active_connections.remove(connection)
        except Exception as exc:
            print(f"[simulation_loop ERROR] {exc}", flush=True)

        await asyncio.sleep(platform.simulator.tick_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(simulation_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

app = FastAPI(title="VayuRoute Edge API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/locations")
async def get_locations():
    return platform.get_locations()


@app.get("/api/weather")
async def get_weather():
    return platform.get_weather()


@app.post("/api/routes/dispatch")
async def dispatch_fleet(request: FleetDispatchRequest):
    return platform.dispatch_routes([assignment.model_dump() for assignment in request.assignments])


@app.post("/set_route")
async def set_route(route: RouteRequest):
    return platform.dispatch_single_route(route.model_dump())


@app.post("/trigger/{event_type}")
async def trigger_event(event_type: str):
    return platform.trigger_event(event_type)


@app.post("/timeline/{horizon}")
async def set_timeline(horizon: int):
    return platform.set_timeline(horizon)


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
    except Exception:
        if websocket in active_connections:
            active_connections.remove(websocket)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("VAYUROUTE_HOST", "127.0.0.1"),
        port=int(os.getenv("VAYUROUTE_PORT", "8000")),
    )
