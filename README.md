# VayuRoute Edge

VayuRoute Edge is a unified logistics intelligence platform that combines:

- VayuRoute predictive routing for Mumbai corridor dispatch
- Cloudtrack-based truck capacity profiling and optimization metrics
- 3dtruck assets for realtime WebGL truck simulation

The platform accepts multi-stop route inputs, predicts edge risk with STGCN, selects routes with a DQN-style planner, tracks live vehicle telemetry, and renders the same fleet state in both a 2D operations map and a 3D simulation view.

## Project Structure

```text
VayuRoute-Edge/
|- backend/
|  |- data/
|  |- integrations/
|  |- models/
|  |- services/
|  |- simulation/
|  |- tracking/
|  |- main.py
|  `- requirements.txt
|- frontend/
|  |- public/models/truck.glb
|  |- src/
|  `- package.json
|- external/
|  |- 3dtruck/
|  `- cloudtrack/
|- setup.bat
|- setup.sh
|- run.bat
`- run.sh
```

## Architecture

### Backend

- `backend/models/stgcn.py`
  Predicts edge travel cost and risk under current horizon and weather conditions.
- `backend/models/router.py`
  Exposes the DQN-style route planner that scores and selects the AI path.
- `backend/tracking/tracker.py`
  Transforms node paths into route geometry, advances truck motion, computes speed, fuel, ETA, and risk exposure, and produces fleet metrics.
- `backend/integrations/cloudtrack_adapter.py`
  Pulls truck dimensions and capacity heuristics from `external/cloudtrack` and assigns a load profile to each vehicle.
- `backend/services/platform.py`
  Orchestrates STGCN inference, AI vs baseline routing, telemetry updates, and websocket payloads.
- `backend/main.py`
  FastAPI entrypoint with REST dispatch endpoints and the realtime websocket stream.

### Frontend

- `frontend/src/App.jsx`
  Unified command dashboard with 2D or 3D view switching.
- `frontend/src/components/LiveMap.jsx`
  Leaflet operations map with predicted risk heat, AI/baseline path divergence, and live truck markers.
- `frontend/src/components/TruckSimulation3D.jsx`
  Three.js scene backed by the truck model imported from `external/3dtruck`.
- `frontend/src/components/VehicleTelemetryPanel.jsx`
  Fleet telemetry cards for position, speed, fuel, ETA, and load utilization.
- `frontend/src/components/RouteBuilder.jsx`
  Multi-vehicle dispatch form posting to the unified backend dispatch API.

## API Surface

- `GET /health`
- `GET /locations`
- `GET /api/weather`
- `POST /set_route`
- `POST /api/routes/dispatch`
- `POST /trigger/{event_type}`
- `POST /timeline/{horizon}`
- `WS /ws`

## Setup

Windows:

```powershell
setup.bat
run.bat
```

Linux or macOS:

```bash
bash setup.sh
bash run.sh
```

Manual setup:

```bash
python -m pip install --user -r backend/requirements.txt
cd frontend && npm install
```

## Runtime Behavior

1. Dispatchers configure one or more vehicles with start, destination, stops, and starting fuel.
2. The backend maps each Mumbai location to graph nodes.
3. STGCN predicts route cost and risk over the selected future horizon.
4. The DQN-style planner selects the AI route and retains a baseline route for comparison.
5. The tracker converts route nodes to coordinates and advances each truck in realtime.
6. Telemetry and route intelligence stream over websockets to the dashboard.
7. The frontend renders the same fleet state in Leaflet and Three.js.

## Verification

The integrated project was verified with:

- `python -m compileall backend`
- backend platform import and live tick execution from `backend/main.py`
- `npm run build` in `frontend/`

The production frontend build currently emits a large-chunk warning for the lazily loaded 3D simulation bundle because Three.js and the truck model are substantial assets, but the build completes successfully.
