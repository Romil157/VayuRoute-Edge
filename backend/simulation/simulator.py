from datetime import datetime


class Simulator:
    def __init__(self):
        self.tick_seconds = 0.5
        self.reset()

    def _vehicle(self, vehicle_id, label, color, start, target, fuel):
        return {
            "id": vehicle_id,
            "label": label,
            "color": color,
            "pos": start,
            "target": target,
            "fuel": float(fuel),
            "fuel_capacity_l": 120.0,
            "stops": [],
            "active_route": "ai",
            "dispatched": False,
            "dirty_route": False,
            "arrival_logged": False,
        }

    def reset(self):
        self.vehicles = [
            self._vehicle("V1", "Monsoon-01", "#58a6ff", "A", "J", 100),
            self._vehicle("V2", "Harbor-02", "#f59e0b", "B", "Q", 82),
        ]
        self.active_event = "normal"
        self.pause_ticks = 0
        self.horizon_mins = 45
        self.logs = ["[System] Unified logistics intelligence platform online."]
        self.dispatch_count = 0
        self.deliveries_completed = 0
        self.tick_counter = 0

    @property
    def is_frozen(self):
        return self.pause_ticks > 0

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.logs.insert(0, f"[{timestamp}] {message}")
        if len(self.logs) > 18:
            self.logs.pop()

    def dispatch_routes(self, assignments, graph_manager):
        vehicle_map = {vehicle["id"]: vehicle for vehicle in self.vehicles}
        for assignment in assignments:
            vehicle_id = assignment.get("vehicle_id", "V1")
            if vehicle_id not in vehicle_map:
                continue

            vehicle = vehicle_map[vehicle_id]
            start = graph_manager.resolve_node_id(assignment.get("start")) or vehicle["pos"]
            end = graph_manager.resolve_node_id(assignment.get("end")) or vehicle["target"]

            stops = []
            for stop in assignment.get("stops", []):
                stop_id = graph_manager.resolve_node_id(stop.get("id"))
                if not stop_id or stop_id in {start, end}:
                    continue
                stops.append({
                    "id": stop_id,
                    "priority": stop.get("priority", "Medium"),
                    "deadline_mins": int(stop.get("deadline_mins", 60)),
                })

            vehicle["pos"] = start
            vehicle["target"] = end
            vehicle["stops"] = stops
            vehicle["fuel"] = float(assignment.get("fuel", vehicle["fuel"]))
            vehicle["dirty_route"] = True
            vehicle["dispatched"] = True
            vehicle["arrival_logged"] = False
            self.dispatch_count += 1
            self.log(
                f"Dispatch updated for {vehicle_id}: "
                f"{graph_manager.get_node(start)['name']} -> {graph_manager.get_node(end)['name']} "
                f"({len(stops)} stop(s))."
            )

    def mark_arrival(self, vehicle_id):
        self.deliveries_completed += 1
        self.log(f"{vehicle_id} reached destination.")

    def trigger_event(self, event_type, value=None):
        if event_type == "timeline":
            self.horizon_mins = int(value)
            self.log(f"Prediction horizon updated to {self.horizon_mins} min.")
            return

        self.active_event = event_type
        self.pause_ticks = 2

        if event_type == "low_fuel":
            for vehicle in self.vehicles:
                vehicle["fuel"] = min(vehicle["fuel"], 15.0)
                vehicle["dirty_route"] = True
            self.log("Fleet fuel reserve dropped into critical range.")
            return

        if event_type == "normal":
            self.log("Network reset to nominal conditions.")
            return

        self.log(f"Scenario injected: {event_type.upper()}.")

    def step(self):
        self.tick_counter += 1
        if self.pause_ticks > 0:
            self.pause_ticks -= 1
