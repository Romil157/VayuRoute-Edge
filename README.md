# VayuRoute Edge (Vayu)

VayuRoute Edge is a production-grade, edge-native autonomous fleet routing system for Mumbai’s highly dynamic logistics environment. It runs entirely on a standard laptop/desktop (CPU-only) and works offline after the initial data load.

---

## New Premium Features (Hackathon Edition)

- Glassmorphism UI – Dark navy theme with blurred translucent panels, neon accents, and smooth animations.
- Multi-Vehicle Simulation – Two independent vehicles (V1 and V2) are tracked simultaneously, each with its own route, fuel level, and AI decisions.
- Baseline vs AI Routing – Toggle between a classic Dijkstra/A* baseline (static distances) and the AI mode (STGCN predictions + DQN routing).
- Future Prediction Timeline – Slider to set the prediction horizon (0 m, 15 m, 30 m, 45 m). The risk heat-map and edge weights scale accordingly.
- Decision Intelligence Panel – Shows flood probability, fuel level, time saved, route confidence, and a human-readable explanation for each reroute.
- Delta Comparison Panel – Real-time display of AI advantage: time saved, risk avoided, and fuel efficiency.
- Event Log & Performance Panel – Live streaming of system events (rain, flood, fuel drop) and latency metrics (< 500 ms per decision).
- Time-Freeze Visual Effect – When an event is triggered the map dims, a “Predicting network failure…” overlay appears, the vehicle pauses for ~0.8 s, then the new route animates.
- Demo Script Mode – One-click automated demo that runs the full event sequence (normal → rain → flood → fuel drop) with deterministic timing.
- Multi-Stop TSP Route Builder – Advanced path planning for multi-destination deliveries using a heuristic-based Traveling Salesperson Problem solver.
- Expanded Mumbai Graph – Comprehensive coverage of the Andheri-Kurla corridor with high-fidelity node density.
- Subgraph Extraction Method – Dynamic pruning of the global graph to isolate relevant local subgraphs, reducing computational overhead for real-time routing.

---

## Project Structure

```
Nexus/
├─ backend/
│   ├─ data/graph_manager.py          # Static Andheri graph, baseline Dijkstra
│   ├─ models/
│   │   ├─ stgcn.py                  # Pure-PyTorch STGCN, horizon-aware risk prediction
│   │   └─ dqn.py                    # DQN router with confidence score
│   ├─ simulation/simulator.py        # Multi-vehicle state, event injection, logs
│   └─ main.py                       # FastAPI + WebSocket, broadcasts vehicles, graph, logs
├─ frontend/
│   ├─ src/
│   │   ├─ App.jsx                    # Top bar, layout, mode toggle
│   │   ├─ components/
│   │   │   ├─ LiveMap.jsx           # Leaflet map, multi-vehicle, risk heat-map, dim overlay
│   │   │   ├─ ControlPanel.jsx      # Buttons, demo script, timeline slider
│   │   │   ├─ TimelineSlider.jsx    # Horizon selector (0-45 min)
│   │   │   ├─ DeltaComparison.jsx   # AI vs baseline metrics per vehicle
│   │   │   ├─ DecisionIntelligence.jsx
│   │   │   ├─ SystemLog.jsx          # Live event log
│   │   │   └─ PerformancePanel.jsx   # Latency & offline status
│   │   └─ index.css                 # Glassmorphism theme, neon accents
│   └─ package.json
├─ setup.bat                         # Creates venv, installs Python & Node deps
├─ run.bat                           # Starts FastAPI (uvicorn) and Vite dev server
└─ README.md                         # This file
```

---

## Setup & Execution

1. Initial Setup – Double-click `setup.bat`.
   - Creates a Python virtual environment (venv).
   - Installs backend requirements (fastapi, torch, networkx, etc.).
   - Installs frontend Node dependencies.
2. Run the System – Double-click `run.bat`.
   - Backend WebSocket server starts on `http://localhost:8000`.
   - Frontend Vite dev server starts on `http://localhost:5173`.
3. Demo – Open the URL in a browser, use the Control Panel to:
   - Toggle Baseline / AI mode.
   - Adjust the Prediction Horizon slider.
   - Press Run Demo Script to see the full event sequence.

---

## How It Works

### 1. Predictor – STGCN
- Consumes a short temporal window of node features (traffic speed, weather) and the static graph adjacency matrix.
- Outputs two edge attributes for the selected horizon:
  - Predicted travel cost (minutes).
  - Risk score (0-100 %).
- The horizon multiplier (0 m → 45 m) scales risk and added travel time, enabling the timeline slider.

### 2. Router – DQN
- Consumes the predicted edge weights.
- Constructs a cost graph where high risk adds a large penalty (+100 for > 50 % risk).
- Runs Dijkstra on this cost graph to obtain the optimal AI route.
- Returns a confidence score (100 – max_risk).

### 3. Baseline Routing
- Pure Dijkstra on the static `base_weight` (distance only). No predictive inputs.
- Serves as the reactive benchmark.

### 4. Backend Loop (≈ 0.5 s per tick)
- Updates vehicle positions, fuel, and event state.
- Calls the STGCN predictor with the current horizon.
- Generates AI and baseline routes for each vehicle.
- Broadcasts a JSON payload via WebSocket containing:
  - `vehicles` array with routes, times, risk, confidence, and rejected-route explanations.
  - `predicted_graph` for heat-map rendering.
  - `state` (event, frozen flag, horizon, logs).
  - `latency_ms` (decision computation time).

---

## Extending the System

- Real-world Data – Replace the synthetic graph in `graph_manager.py` with an OpenStreetMap import and live traffic feeds. The system will still fall back to the cached graph when offline.
- Additional Vehicles – Extend `Simulator` with more entries in the `vehicles` list.
- Custom Events – Add new REST endpoints in `main.py` and corresponding UI buttons.
- TSP Integration – Utilize the new subgraph extraction method to optimize multi-stop delivery sequences within specific city zones.

---

This project is released under the MIT License. Feel free to adapt, extend, and use it for hackathons, research, or production deployments.
