# VayuRoute Edge -- Predictive Logistics Intelligence Platform

VayuRoute Edge is an edge-native, autonomous fleet routing system built for Mumbai logistics. It predicts corridor-level disruptions before they materialise, reroutes vehicles around emerging risk zones, and quantifies the operational delta between reactive and predictive routing in real time.

The platform runs entirely on CPU. No cloud AI APIs are called at any point. All inference, routing, and telemetry computation happen locally within a single-machine deployment, making it suitable for edge environments with intermittent connectivity.

---

## Key Highlights

| Capability | Detail |
|---|---|
| Predictive AI | STGCN forecasts corridor risk 45 min ahead |
| Cost Model | Multi-objective: 35% time + 50% risk + 15% fuel |
| Explainability | Human-readable reason for every routing decision |
| Failure Comparison | Side-by-side baseline failure vs AI success |
| Business Impact | Cost saved, SLA breaches avoided, fuel efficiency |
| Demo Mode | Automated 22-second scenario sequence |
| Offline-First | CPU-only, no cloud APIs, works without internet |
| Visualization | 2D Leaflet map + 3D Three.js truck simulation |

---

## Overview

### The Problem

Mumbai's road network is among the most disruption-prone in the world. Monsoon flooding, sudden waterlogging, and unpredictable congestion can invalidate a dispatch plan minutes after it is issued. Reactive routing -- the approach used by conventional fleet systems -- responds to disruptions only after vehicles have already entered affected zones. This leads to SLA breaches, fuel waste, and cascading delays across the fleet.

### The Approach

VayuRoute Edge replaces reactive routing with predictive routing. A Spatio-Temporal Graph Convolutional Network (STGCN) forecasts corridor-level travel cost and flood risk over a configurable future horizon (up to 45 minutes). A multi-objective RiskAwareRouter consumes these predictions to select routes that minimise a weighted combination of travel time, risk exposure, and fuel consumption -- before the disruption reaches the vehicle.

### Reactive vs Predictive

| Dimension | Reactive Routing | Predictive Routing (VayuRoute) |
|---|---|---|
| Timing | Responds after disruption | Acts before disruption |
| Risk handling | Enters flood zone, then reroutes | Avoids flood zone entirely |
| Fuel efficiency | Detours after wasted travel | Optimal path from dispatch |
| SLA compliance | Breached under weather events | Maintained through anticipation |

---

## Key Features

- **STGCN Prediction Engine** -- 2-layer spatio-temporal graph convolutional network predicting per-edge travel cost and flood risk. Runs in under 300 ms on CPU. Exported as TorchScript for portable edge deployment.
- **RiskAwareRouter** -- Multi-objective route planner using a composite cost function: `cost = 0.35 * time + 0.50 * risk + 0.15 * fuel`. Selects the route with the lowest aggregate cost across all candidate paths.
- **Multi-Stop TSP Routing** -- Greedy nearest-neighbour heuristic for scalable multi-stop routing with permutation-based fallback for small stop sets (5 or fewer) to guarantee optimality.
- **Multi-Vehicle Simulation** -- Concurrent dispatch of multiple trucks with independent start, destination, stops, priority levels, and SLA deadlines.
- **Real-Time Telemetry** -- Per-vehicle tracking of position, speed, heading, fuel level, ETA, risk exposure, and route progress updated every 500 ms.
- **2D Operations Map** -- Leaflet-based map rendering AI route, baseline route, divergence indicators, and live truck markers on a dark CARTO basemap.
- **3D Truck Simulation** -- Three.js scene with GLTF truck models synchronised to backend telemetry. Lazy-loaded to reduce initial bundle size.
- **Cloudtrack Integration** -- Truck dimension and capacity profiling from the Cloudtrack dataset. Load utilisation metrics computed per vehicle.
- **Live Weather Feed** -- Open-Meteo API integration for real-time Mumbai rain intensity, wind speed, and storm detection. Cached for 300 seconds; works fully offline with fallback values.
- **Failure Simulation** -- Inject rain, flood, and low-fuel scenarios to observe AI rerouting in real time. A turbo demo sequence automates the full disruption lifecycle.
- **Offline-First Design** -- All ML inference runs locally on CPU. OSM graph cached to disk. Weather cached with TTL. No external service required for core operation.

---

## System Architecture

```
                        +-------------------+
                        |    React Frontend  |
                        |  (Vite + Leaflet   |
                        |   + Three.js)      |
                        +---------+---------+
                                  |
                           WebSocket /ws
                                  |
                        +---------+---------+
                        |   FastAPI Backend  |
                        |    (main.py)       |
                        +---------+---------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
    +---------+------+  +---------+------+  +---------+------+
    |  STGCN Model   |  | RiskAwareRouter|  |   Simulator    |
    |  (stgcn.py)    |  |  (router.py)   |  | (simulator.py) |
    +--------+-------+  +--------+-------+  +--------+-------+
             |                   |                   |
    +--------+-------+  +--------+-------+  +--------+-------+
    | Weather Feed   |  | Graph Manager  |  |    Tracker     |
    | (Open-Meteo)   |  |  (OSM/cache)   |  | (tracker.py)   |
    +----------------+  +--------+-------+  +--------+-------+
                                 |                   |
                        +--------+-------+  +--------+-------+
                        | mumbai_graph   |  |   Cloudtrack   |
                        |  .gpickle      |  |   Adapter      |
                        +----------------+  +----------------+
```

### Backend (Python / FastAPI)

| Module | Responsibility |
|---|---|
| `backend/main.py` | FastAPI entrypoint. REST endpoints for dispatch, events, and timeline. WebSocket stream for real-time telemetry at 2 Hz. |
| `backend/models/stgcn.py` | STGCN prediction service. Builds adjacency matrix, runs forward pass, blends neural output with rule-based event overlays. |
| `backend/models/router.py` | RiskAwareRouter. Builds cost graph from predicted edges, runs Dijkstra with composite cost, produces optimal route and alternative candidates. |
| `backend/tracking/tracker.py` | Route geometry builder. Converts node paths to coordinates, advances vehicle motion per tick, computes telemetry (speed, fuel, ETA, risk), builds fleet business metrics. |
| `backend/simulation/simulator.py` | Vehicle state manager. Handles dispatch, event injection, fuel drops, and delivery completion tracking. |
| `backend/data/graph_manager.py` | Road network manager. Loads Mumbai OSM graph via osmnx, caches to disk, falls back to 18-node synthetic graph. Maps OSM nodes to named anchor locations. |
| `backend/data/weather_feed.py` | Open-Meteo weather integration. Fetches rain, wind, and storm data for Mumbai. Cached with 300s TTL. |
| `backend/integrations/cloudtrack_adapter.py` | Truck profiling from Cloudtrack dataset. Assigns dimensions, capacity, and load utilisation to each vehicle. |

### Frontend (React / Vite)

| Component | Responsibility |
|---|---|
| `App.jsx` | Root dashboard. 2D/3D view toggle, AI/Baseline mode switch, status strip, sidebar panel layout. |
| `LiveMap.jsx` | Leaflet map. AI route (solid), baseline route (dashed), divergence overlay, node markers, live vehicle markers. |
| `TruckSimulation3D.jsx` | Three.js scene. GLTF truck models, route ribbons, camera controls. Lazy-loaded. |
| `RouteBuilder.jsx` | Fleet dispatch form. Per-vehicle start, destination, stops, priority, SLA deadline, fuel. |
| `VehicleTelemetryPanel.jsx` | Live telemetry cards. Position, speed, fuel, ETA, risk, load utilisation, route progress. |
| `DecisionIntelligence.jsx` | AI decision breakdown. Route score, confidence, projected time, maximum risk, explanation text. |
| `DeltaComparison.jsx` | AI vs baseline comparison. Time saved, fuel delta, distance comparison per vehicle. |
| `BusinessImpact.jsx` | Operations impact metrics. Cost saved, time saved, fuel saved, efficiency, SLA breaches avoided. |
| `CostFunctionPanel.jsx` | Cost model display. Time, risk, fuel components and composite route score. |
| `ControlPanel.jsx` | Simulation controls. Event triggers (rain, flood, low fuel), scenario reset, turbo demo sequence. |
| `PerformancePanel.jsx` | Platform telemetry. Decision latency, graph source, AI stack, model footprint, weather source. |

---

## Data Flow

```
User configures dispatch (start, destination, stops, fuel)
         |
         v
POST /api/routes/dispatch --> Simulator marks vehicles as dispatched
         |
         v
Simulation loop (every 500ms):
  1. Fetch weather from Open-Meteo (cached)
  2. Sync weather risk onto road graph
  3. Extract subgraph around active vehicle endpoints
  4. STGCN forward pass --> predicted edge weights and risk
  5. RiskAwareRouter --> optimal AI route per vehicle
  6. Graph Manager --> baseline route per vehicle
  7. Tracker --> sync routes, advance motion, compute telemetry
  8. Build vehicle payloads and business metrics
         |
         v
WebSocket /ws --> JSON payload streamed to all connected clients
         |
         v
Frontend renders map, telemetry, decision panels, and 3D simulation
```

---

## Project Structure

```
VayuRoute-Edge/
|-- backend/
|   |-- data/
|   |   |-- graph_manager.py        # OSM/synthetic road network
|   |   |-- weather_feed.py         # Open-Meteo weather integration
|   |   |-- mumbai_graph.gpickle    # Cached OSM graph
|   |-- integrations/
|   |   |-- cloudtrack_adapter.py   # Truck profiling
|   |-- models/
|   |   |-- stgcn.py                # STGCN prediction service
|   |   |-- router.py               # RiskAwareRouter
|   |   |-- stgcn_edge.pt           # Exported TorchScript model
|   |-- services/
|   |   |-- platform.py             # Orchestration layer
|   |-- simulation/
|   |   |-- simulator.py            # Vehicle state and events
|   |-- tracking/
|   |   |-- tracker.py              # Motion, telemetry, metrics
|   |-- main.py                     # FastAPI entrypoint
|   |-- schemas.py                  # Pydantic request models
|   |-- requirements.txt
|-- frontend/
|   |-- public/models/truck.glb     # 3D truck asset
|   |-- src/
|   |   |-- components/             # React UI components
|   |   |-- hooks/                  # WebSocket hook
|   |   |-- lib/                    # API utilities
|   |   |-- App.jsx                 # Root component
|   |   |-- main.jsx                # Entry point
|   |-- package.json
|-- external/
|   |-- 3dtruck/                    # Source truck model
|   |-- cloudtrack/                 # Truck catalog dataset
|-- benchmarks/
|   |-- run_evaluation.py           # Automated evaluation suite
|   |-- RESULTS.md                  # Benchmark results
|-- setup.bat / setup.sh            # Dependency installation
|-- run.bat / run.sh                # Launch scripts
```

---

## Setup Instructions

### Windows

```powershell
# Install all dependencies
setup.bat

# Start backend and frontend
run.bat
```

### Linux / macOS

```bash
# Install all dependencies
bash setup.sh

# Start backend and frontend
bash run.sh
```

### Manual Setup

```bash
# Backend dependencies
python -m pip install --user -r backend/requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..

# Start backend (terminal 1)
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# Start frontend (terminal 2)
cd frontend
npm run dev
```

### Access

| Service | URL |
|---|---|
| Frontend dashboard | http://127.0.0.1:5173 |
| Backend API | http://127.0.0.1:8000 |
| Health check | http://127.0.0.1:8000/health |
| WebSocket stream | ws://127.0.0.1:8000/ws |

---

## Demo Instructions

### 1. Dispatch Routes

Open the dashboard. The Fleet Dispatch Console on the right sidebar shows two pre-configured vehicles:

- **V1**: Andheri Station (A) to Dadar TT (J)
- **V2**: WEH Hub (F) to Colaba Causeway (R)

Adjust start, destination, stops, priority, and fuel as needed. Click **Dispatch All Vehicles** to begin routing.

### 2. Observe AI Routing

Switch between **AI View** and **Baseline View** using the toggle in the header. In AI view, the solid route line shows the RiskAwareRouter path. When routes diverge, a faint dashed orange line shows the rejected baseline path with an explanation tooltip.

### 3. Trigger Disruptions

Use the **Simulation Control** panel to inject events:

- **Trigger Rain Module** -- Moderate rain increases risk on flood-prone corridors
- **Inject Flood Parameters** -- Severe flooding forces major rerouting
- **Drop Fuel Telemetry** -- Fuel drops to critical range, triggering fuel-aware path selection
- **Reset Scenario** -- Return to normal conditions

### 4. Run Turbo Demo

Click **Start Demo Sequence** to automatically cycle through normal, rain, flood, low fuel, and recovery scenarios over 20 seconds.

### 5. Monitor Panels

- **Operations Impact** -- Cost saved, time saved, fuel saved, efficiency percentage
- **AI vs Baseline** -- Per-vehicle comparison of time, fuel, and distance
- **Decision Intelligence** -- Route score, confidence, projected time, risk, and explanation
- **Cost Model** -- Component breakdown of the multi-objective cost function
- **Vehicle Tracking** -- Live telemetry for position, speed, fuel, ETA, and risk exposure

### 6. 3D View

Toggle to **3D Simulation** to see truck models following route geometry in a Three.js scene synchronised with backend telemetry.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/locations` | All named graph nodes |
| `GET` | `/api/weather` | Current weather features |
| `POST` | `/set_route` | Single vehicle route injection |
| `POST` | `/api/routes/dispatch` | Multi-vehicle fleet dispatch |
| `POST` | `/trigger/{event_type}` | Inject scenario (normal, rain, flood, low_fuel) |
| `POST` | `/timeline/{horizon}` | Set prediction horizon (0-45 minutes) |
| `WS` | `/ws` | Real-time telemetry stream (2 Hz) |

---

## AI Stack

### STGCN (Spatio-Temporal Graph Convolutional Network)

- **Architecture**: 2 STGCN layers (spatial linear + temporal Conv1d) followed by a linear output head
- **Input features**: 5 per node (base weight, current risk, rain intensity, wind factor, storm flag)
- **Output**: 2 per node (predicted cost delta, predicted risk delta)
- **Hidden dimension**: 16
- **Temporal window**: 5 steps
- **Initialisation**: Xavier uniform
- **Inference**: Sub-300 ms on CPU (verified at startup)
- **Export**: TorchScript for portable deployment

### RiskAwareRouter

- **Cost function**: `cost(edge) = 0.35 * travel_time + 0.50 * risk_score + 0.15 * fuel_penalty`
- **Path search**: Dijkstra with composite cost weights
- **Multi-stop**: Greedy nearest-neighbour TSP with permutation fallback for small stop sets
- **Output**: Optimal route, alternative candidates (faster-but-risky, slower-but-safest), cost function breakdown, confidence score
- **Confidence**: `100 - max_risk_on_path`, clamped 0-100

---

## Road Network

The graph manager loads the Mumbai road network from OpenStreetMap using osmnx and caches it to disk as a NetworkX graph. If osmnx is unavailable, a built-in 18-node synthetic graph covering the Andheri-to-Colaba corridor is used as an offline fallback.

### Named Anchor Nodes (18)

| ID | Location | Coordinates |
|---|---|---|
| A | Andheri Station | 19.1197, 72.8464 |
| B | SV Road Junction | 19.1170, 72.8420 |
| C | DN Nagar | 19.1240, 72.8310 |
| D | Juhu Circle | 19.1130, 72.8320 |
| E | Vile Parle West | 19.1020, 72.8360 |
| F | WEH Hub | 19.1150, 72.8550 |
| G | Bandra Kurla Complex | 19.0658, 72.8643 |
| H | Bandra Station | 19.0544, 72.8402 |
| I | Dharavi | 19.0402, 72.8553 |
| J | Dadar TT | 19.0178, 72.8437 |
| K | Worli Naka | 19.0060, 72.8131 |
| L | Lower Parel | 18.9950, 72.8270 |
| M | Mahalaxmi Race Course | 18.9818, 72.8159 |
| N | Mumbai Central | 18.9696, 72.8193 |
| O | Marine Drive | 18.9440, 72.8242 |
| P | Churchgate | 18.9322, 72.8264 |
| Q | CSMT | 18.9398, 72.8354 |
| R | Colaba Causeway | 18.9174, 72.8258 |

---

## Future Improvements

- **Full Mumbai Graph** -- Expand beyond the Andheri-Kurla corridor to cover the entire Mumbai metropolitan region with thousands of nodes.
- **Real-Time Traffic APIs** -- Integrate live traffic feeds to replace static base weights with observed travel times.
- **Fleet Scaling** -- Support 50+ concurrent vehicles with priority queuing and load balancing.
- **Historical Training** -- Train the STGCN on historical Mumbai flood and traffic data for empirically calibrated predictions.
- **Mobile Dispatch** -- Driver-facing mobile interface for receiving route updates and reporting ground conditions.
- **Container Deployment** -- Docker and Kubernetes manifests for production edge deployment.

---

## AI Decision Intelligence

Every routing decision is explainable. The system produces:

- **Route Score** -- Composite cost from the multi-objective function
- **Time Cost** -- Travel time component
- **Risk Penalty** -- Flood and congestion risk component
- **Fuel Cost** -- Fuel consumption estimate
- **Confidence Score** -- `100 - max_risk_on_path`, clamped 0-100
- **Reason** -- Human-readable explanation, e.g. "Route avoids 3 high-risk segments (max risk 82%) and saves 10.2 min vs baseline."

Alternative routes (faster-but-risky, slower-but-safest) are also computed and displayed with rejection reasons.

---

## Failure vs Success Comparison

The dashboard explicitly shows what happens when the baseline (reactive) route fails:

**Baseline outcome:**
- Enters flood-prone corridor near Bandra/Dharavi
- Risk exposure exceeds 60%
- SLA deadline breached
- Estimated delay increases under weather events

**AI outcome:**
- Detects predicted disruption via STGCN
- Reroutes through safer corridor before disruption
- Maintains SLA compliance
- Completes delivery with lower fuel consumption

This comparison is visible per-vehicle in the AI vs Baseline panel.

---

## Verification

```bash
# Compile check
python -m compileall backend

# Backend import and startup
cd backend && python -c "from services.platform import LogisticsIntelligencePlatform; p = LogisticsIntelligencePlatform(); print(p.tick().keys())"

# Frontend production build
cd frontend && npm run build
```

---

## License

This project is part of the VayuRoute research initiative for predictive logistics intelligence in disruption-prone urban environments.
