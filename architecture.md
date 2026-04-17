# VayuRoute Edge Architecture

## 1. System Overview
VayuRoute Edge is a completely offline, decentralized predictive routing platform designed exclusively for CPU execution on edge nodes. It bypasses traditional reactive latency problems by forecasting edge graph topology changes (such as flooding and congestion).

## 2. Component Pipeline
- **Predictor (STGCN Layer):** Consumes raw topology constraints and environment signals to output predicted temporal edge weights.
- **Router (DQN Layer):** Operates on the predicted graph. Utilizing a deeply reinforced Q-value map, the routing agent dynamically penalizes high-risk paths, prioritizing robust low-loss pathing configurations over volatile fastest routes.
- **WebSocket Streaming Engine:** Asynchronous Python (FastAPI) infrastructure seamlessly unifying PyTorch processes and frontend visual dashboards.
- **React Frontend:** High-performance Vite/React integration representing the edge graph dynamically through geo-cached offline mapping.
