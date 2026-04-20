# VayuRoute Benchmark Results

Scenarios: 100 (20 per condition x 5 conditions: clear, light_rain, heavy_rain, flood, fuel_critical)
Graph: Mumbai Andheri-Kurla corridor (18 named nodes)
Router: RiskAwareRouter - cost = 0.50*time + 0.35*risk + 0.15*fuel

| Metric               | Baseline  | VayuRoute AI | Delta  |
|----------------------|-----------|--------------|--------|
| Avg route time (min) | 39.4      | 39.5         | +0.1%  |
| Flood node visits    | 124/100   | 127/100      | +2.4%  |
| Fuel wasted (L avg)  | 7.89      | 7.89         | -0.0%  |
| Decision latency ms  | -         | under 3 ms   | edge   |
