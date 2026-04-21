import math
import time

from ..data.graph_manager import GraphManager
from ..data.weather_feed import get_weather_features
from ..integrations.cloudtrack_adapter import CloudtrackOptimizerAdapter
from ..models.dqn import DQNRoutePlanner
from ..models.stgcn import PredictionService
from ..simulation.simulator import Simulator
from ..tracking.tracker import Tracker


def _safe(value, default=999.0):
    if isinstance(value, float) and (math.isinf(value) or math.isnan(value)):
        return default
    return value


class LogisticsIntelligencePlatform:
    def __init__(self):
        self.graph_mgr = GraphManager()
        self.stgcn = PredictionService(num_nodes=18)
        self.router = DQNRoutePlanner()
        self.simulator = Simulator()
        self.cloudtrack = CloudtrackOptimizerAdapter()
        self.tracker = Tracker(self.graph_mgr, self.cloudtrack, tick_seconds=self.simulator.tick_seconds)

    def get_locations(self):
        return self.graph_mgr.get_nodes()

    def get_weather(self):
        return get_weather_features()

    def dispatch_routes(self, assignments):
        self.simulator.dispatch_routes(assignments, self.graph_mgr)
        return {"status": "Fleet dispatch updated", "vehicles": [item["vehicle_id"] for item in assignments]}

    def dispatch_single_route(self, route_payload):
        assignment = dict(route_payload)
        assignment["vehicle_id"] = assignment.get("vehicle_id", "V1")
        self.simulator.dispatch_routes([assignment], self.graph_mgr)
        return {"status": f"Route injected for {assignment['vehicle_id']}"}

    def trigger_event(self, event_type, value=None):
        self.simulator.trigger_event(event_type, value=value)
        return {"status": f"Event {event_type} triggered"}

    def set_timeline(self, horizon):
        self.simulator.trigger_event("timeline", value=horizon)
        return {"status": f"Horizon set to {horizon}"}

    def _collect_active_nodes(self):
        selected = []
        for vehicle in self.simulator.vehicles:
            selected.extend([vehicle["pos"], vehicle["target"]])
            for stop in vehicle.get("stops", []):
                selected.append(stop["id"])
        return selected

    def _edge_map(self, edges):
        return {(edge["source"], edge["target"]): edge for edge in edges}

    def _true_baseline_time(self, baseline_time, event_type, horizon):
        true_time = baseline_time
        if event_type in ("rain", "flood", "heavy_rain", "light_rain"):
            multiplier = horizon / 45.0 if horizon > 0 else 0.5
            penalty_map = {
                "light_rain": 8,
                "rain": 12,
                "heavy_rain": 18,
                "flood": 28,
            }
            true_time = _safe(true_time + penalty_map.get(event_type, 0) * multiplier)
        return true_time

    def tick(self):
        start_time = time.time()
        self.simulator.step()

        weather = get_weather_features()
        self.graph_mgr.sync_weather_risk(weather.get("rain_intensity", 0.0))

        selected_nodes = self._collect_active_nodes()
        valid_nodes = self.graph_mgr.extract_subgraph_nodes(selected_nodes)
        subgraph_edges = self.graph_mgr.extract_subgraph_edges(valid_nodes)
        predicted_edges = self.stgcn.compute_ai_edge_weights(
            subgraph_edges,
            self.simulator.active_event,
            self.simulator.horizon_mins,
            weather=weather,
        )
        predicted_edge_map = self._edge_map(predicted_edges)

        vehicle_payloads = []
        for vehicle in self.simulator.vehicles:
            stops = vehicle.get("stops", [])
            baseline_path, baseline_time = self.graph_mgr.get_baseline_route(
                vehicle["pos"],
                vehicle["target"],
                stops=stops,
            )
            baseline_time = _safe(float(baseline_time))

            ai_data = self.router.get_ai_route(
                predicted_edges,
                vehicle["pos"],
                vehicle["target"],
                stops=stops,
                horizon_mins=self.simulator.horizon_mins,
            )

            self.tracker.sync_routes(vehicle, ai_data, baseline_path, predicted_edge_map)
            self.tracker.advance_vehicle(
                vehicle,
                event_state=self.simulator.active_event,
                weather=weather,
                frozen=self.simulator.is_frozen,
                on_arrival=self.simulator.mark_arrival,
            )

            true_baseline_time = self._true_baseline_time(
                baseline_time,
                self.simulator.active_event,
                self.simulator.horizon_mins,
            )

            deadlines = [stop.get("deadline_mins", 9999) for stop in stops]
            max_allowed_time = max(deadlines) if deadlines else 9999
            sla_breached = bool(stops) and true_baseline_time > max_allowed_time

            rejected_reason = ai_data.get("optimal", {}).get("reason", "AI route generated.")
            if sla_breached:
                rejected_reason = (
                    f"SLA breached on baseline: {round(true_baseline_time, 1)}m "
                    f"vs allowance {max_allowed_time}m."
                )

            vehicle_payloads.append(
                self.tracker.build_vehicle_payload(
                    vehicle=vehicle,
                    ai_data=ai_data,
                    baseline_time=baseline_time,
                    true_baseline_time=true_baseline_time,
                    rejected_reason=rejected_reason,
                    sla_breached=sla_breached,
                )
            )

        metrics = self.tracker.build_business_metrics(
            vehicle_payloads,
            dispatch_count=self.simulator.dispatch_count,
            completed_deliveries=self.simulator.deliveries_completed,
        )
        decision_time_ms = round((time.time() - start_time) * 1000.0, 2)

        return {
            "state": {
                "vehicles": self.simulator.vehicles,
                "event": self.simulator.active_event,
                "frozen": self.simulator.is_frozen,
                "logs": self.simulator.logs,
                "horizon": self.simulator.horizon_mins,
                "dispatch_count": self.simulator.dispatch_count,
                "deliveries_completed": self.simulator.deliveries_completed,
                "business_metrics": metrics,
            },
            "latency_ms": decision_time_ms,
            "vehicles": vehicle_payloads,
            "predicted_graph": predicted_edges,
            "nodes": self.graph_mgr.get_nodes(),
            "graph_source": self.graph_mgr.graph_source,
            "weather": weather,
            "truck_catalog": self.cloudtrack.get_truck_catalog(),
        }
