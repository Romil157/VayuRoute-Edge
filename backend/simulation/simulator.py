import asyncio
from datetime import datetime

class Simulator:
    def __init__(self):
        self.reset()
        
    def reset(self):
        # Multi-vehicle support
        # active_path: current path being traversed
        # path_idx: current index in the path
        # V1: Andheri East corridor (F=WEH Hub) -> Kurla side (G=Bandra Kurla Complex)
        # V2: Andheri Station (A) -> SV Road Junction (B) — short corridor loop
        self.vehicles = [
            {"id": "V1", "pos": "F", "target": "G", "fuel": 100, "stops": [], "active_path": [], "path_idx": 0},
            {"id": "V2", "pos": "A", "target": "B", "fuel": 80,  "stops": [], "active_path": [], "path_idx": 0},
        ]

        self.active_event = "normal"
        self.pause_duration = 0
        self.horizon_mins = 45
        self.logs = ["[System] Predictive ROI logistics simulation online."]
        
        self.business_metrics = {
            "cost_saved": 0,
            "deliveries_completed": 0,
            "sla_breached_baseline": 0,
            "efficiency_percentage": 0.0,
            "total_ai_time": 0,
            "total_baseline_time": 0
        }
        self.tick_counter = 0

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.logs.insert(0, f"[{timestamp}] {message}")
        if len(self.logs) > 10:
            self.logs.pop()

    def get_state(self):
        return {
            "vehicles": self.vehicles,
            "event": self.active_event,
            "frozen": self.pause_duration > 0,
            "logs": self.logs,
            "horizon": self.horizon_mins,
            "business_metrics": self.business_metrics
        }

    def set_custom_route(self, route_payload):
        self.vehicles[0]["pos"] = route_payload.get("start", "C")
        self.vehicles[0]["target"] = route_payload.get("end", "R")
        self.vehicles[0]["stops"] = route_payload.get("stops", [])
        self.vehicles[0]["active_path"] = [] # Reset path traversal
        self.vehicles[0]["path_idx"] = 0
        self.log(f"Fleet Dispatch: V1 route updated.")
        self.business_metrics["deliveries_completed"] += 1

    def update_active_path(self, vehicle_id, path):
        for v in self.vehicles:
            if v["id"] == vehicle_id:
                # Only update if path changed or we are empty
                if v["active_path"] != path:
                    v["active_path"] = path
                    v["path_idx"] = 0

    def trigger_event(self, event_type, value=None):
        if event_type == "timeline":
            self.horizon_mins = int(value)
            return
        if event_type == "low_fuel":
            self.vehicles[0]["fuel"] = 15
            self.log("Emergency: Low Fuel Triggered.")
            self.pause_duration = 2
            return
        self.active_event = event_type
        self.log(f"Alert: {event_type.upper()} event started.")
        self.pause_duration = 2

    def step(self):
        if self.pause_duration > 0:
            self.pause_duration -= 1
            return
        
        self.tick_counter += 1
        
        for v in self.vehicles:
            v["fuel"] = max(0, round(v["fuel"] - 0.2, 2))
            
            # Move vehicle every 3 ticks (~1.5s per node) for a fast-paced demo
            if v["active_path"] and len(v["active_path"]) > 1:
                if self.tick_counter % 3 == 0:
                    v["path_idx"] = min(v["path_idx"] + 1, len(v["active_path"]) - 1)
                    v["pos"] = v["active_path"][v["path_idx"]]
                    
                    if v["pos"] == v["target"]:
                        v["active_path"] = [] # Destination reached
                        self.log(f"Unit {v['id']} arrived at Target.")
