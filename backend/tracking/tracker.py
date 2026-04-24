import math


DEFAULT_TICK_SECONDS = 0.5
SIMULATION_TIME_SCALE = 6.0
DEFAULT_FUEL_CAPACITY_L = 120.0
SPEED_SCALE = 0.25
MAX_STEP_KM = 0.01


def haversine_km(lat1, lng1, lat2, lng2):
    radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return radius_km * 2 * math.asin(math.sqrt(a))


def interpolate_coord(start, end, ratio):
    return {
        "lat": round(start["lat"] + (end["lat"] - start["lat"]) * ratio, 6),
        "lng": round(start["lng"] + (end["lng"] - start["lng"]) * ratio, 6),
    }


def bearing_degrees(start, end):
    lat1 = math.radians(start["lat"])
    lat2 = math.radians(end["lat"])
    delta_lng = math.radians(end["lng"] - start["lng"])

    x = math.sin(delta_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lng)
    bearing = (math.degrees(math.atan2(x, y)) + 360) % 360
    return round(bearing, 1)


def risk_status(risk_value, fuel_pct):
    if fuel_pct <= 15 or risk_value >= 60:
        return "High"
    if fuel_pct <= 30 or risk_value >= 30:
        return "Medium"
    return "Low"


class Tracker:
    def __init__(self, graph_manager, cloudtrack_adapter, tick_seconds=DEFAULT_TICK_SECONDS):
        self.graph_manager = graph_manager
        self.cloudtrack = cloudtrack_adapter
        self.tick_seconds = tick_seconds
        self.time_scale = SIMULATION_TIME_SCALE

    def _empty_route(self):
        return {
            "nodes": [],
            "coordinates": [],
            "segments": [],
            "summary": {
                "distance_km": 0.0,
                "projected_time": 0.0,
                "avg_risk": 0.0,
                "max_risk": 0.0,
                "fuel_est_l": 0.0,
            },
        }

    def _predicted_edge(self, edge_map, source, target):
        return edge_map.get((source, target)) or edge_map.get((target, source))

    def _build_route_package(self, path_nodes, edge_map, route_kind):
        if not path_nodes:
            return self._empty_route()

        coordinates = self.graph_manager.path_to_coordinates(path_nodes)
        if len(coordinates) < 2:
            return {
                "nodes": path_nodes,
                "coordinates": coordinates,
                "segments": [],
                "summary": {
                    "distance_km": 0.0,
                    "projected_time": 0.0,
                    "avg_risk": 0.0,
                    "max_risk": 0.0,
                    "fuel_est_l": 0.0,
                },
            }

        segments = []
        total_distance_km = 0.0
        total_time_mins = 0.0
        total_risk_weight = 0.0
        max_risk = 0.0

        for index in range(len(path_nodes) - 1):
            source = path_nodes[index]
            target = path_nodes[index + 1]
            source_node = coordinates[index]
            target_node = coordinates[index + 1]

            base_edge = self.graph_manager.get_edge_details(source, target) or {}
            predicted_edge = self._predicted_edge(edge_map, source, target) or {}

            distance_km = round(
                float(base_edge.get("distance_m", 0.0)) / 1000.0
                if base_edge.get("distance_m")
                else haversine_km(
                    source_node["lat"],
                    source_node["lng"],
                    target_node["lat"],
                    target_node["lng"],
                ),
                3,
            )

            travel_time_mins = float(
                predicted_edge.get("weight", 0.0)
                if route_kind == "ai"
                else base_edge.get("base_weight", base_edge.get("weight", 0.0))
            )
            risk = float(predicted_edge.get("risk", 0.0) if route_kind == "ai" else 0.0)
            speed_kmh = round(
                max(8.0, distance_km / max(travel_time_mins / 60.0, 0.01)),
                1,
            )

            segments.append({
                "source": source,
                "target": target,
                "source_name": source_node["name"],
                "target_name": target_node["name"],
                "start": {"lat": source_node["lat"], "lng": source_node["lng"]},
                "end": {"lat": target_node["lat"], "lng": target_node["lng"]},
                "distance_km": distance_km,
                "travel_minutes": round(travel_time_mins, 2),
                "risk": round(risk, 2),
                "speed_kmh": speed_kmh,
            })

            total_distance_km += distance_km
            total_time_mins += travel_time_mins
            total_risk_weight += risk * max(distance_km, 0.1)
            max_risk = max(max_risk, risk)

        avg_risk = total_risk_weight / max(total_distance_km, 0.1)
        fuel_est_l = total_distance_km * 0.32 + max_risk / 150.0

        return {
            "nodes": path_nodes,
            "coordinates": coordinates,
            "segments": segments,
            "summary": {
                "distance_km": round(total_distance_km, 2),
                "projected_time": round(total_time_mins, 1),
                "avg_risk": round(avg_risk, 1),
                "max_risk": round(max_risk, 1),
                "fuel_est_l": round(fuel_est_l, 1),
            },
        }

    def ensure_vehicle_state(self, vehicle):
        start_node = self.graph_manager.get_node(vehicle["pos"])
        coordinate = {
            "lat": round(float(start_node["lat"]), 6),
            "lng": round(float(start_node["lng"]), 6),
        }

        vehicle.setdefault("fuel_capacity_l", DEFAULT_FUEL_CAPACITY_L)
        vehicle.setdefault("active_route", "ai")
        vehicle.setdefault("plans", {"ai": self._empty_route(), "baseline": self._empty_route()})
        vehicle.setdefault("motion", {
            "route_signature": "",
            "segment_index": 0,
            "segment_progress_km": 0.0,
            "distance_travelled_km": 0.0,
            "arrived": False,
        })
        vehicle.setdefault("telemetry", {
            "coordinate": coordinate,
            "location_label": start_node["name"],
            "speed_kmh": 0.0,
            "fuel_percent": round(vehicle.get("fuel", 100.0), 1),
            "fuel_liters": round(vehicle.get("fuel_capacity_l", DEFAULT_FUEL_CAPACITY_L) * vehicle.get("fuel", 100.0) / 100.0, 1),
            "risk_exposure": 0.0,
            "risk_status": "Low",
            "distance_remaining_km": 0.0,
            "eta_minutes": 0.0,
            "route_progress": 0.0,
            "heading_deg": 0.0,
            "status": "Idle",
        })
        return vehicle

    def sync_routes(self, vehicle, ai_data, baseline_path, predicted_edge_map):
        self.ensure_vehicle_state(vehicle)

        ai_nodes = ai_data.get("optimal", {}).get("path", []) or []
        baseline_nodes = baseline_path or []

        ai_route = self._build_route_package(ai_nodes, predicted_edge_map, "ai")
        baseline_route = self._build_route_package(baseline_nodes, predicted_edge_map, "baseline")

        vehicle["plans"]["ai"] = ai_route
        vehicle["plans"]["baseline"] = baseline_route
        vehicle["truck_profile"] = self.cloudtrack.assign_truck_profile(
            vehicle["id"],
            vehicle.get("stops", []),
            ai_nodes or baseline_nodes,
        )

        signature = ">".join(ai_route["nodes"])
        old_signature = vehicle["motion"].get("route_signature", "")
        old_nodes = old_signature.split(">") if old_signature else []
        new_nodes = ai_route["nodes"]
        route_endpoints_changed = (
            not old_nodes
            or not new_nodes
            or old_nodes[0] != new_nodes[0]
            or old_nodes[-1] != new_nodes[-1]
        )
        if vehicle.get("dirty_route") or route_endpoints_changed:
            vehicle["motion"] = {
                "route_signature": signature,
                "segment_index": 0,
                "segment_progress_km": 0.0,
                "distance_travelled_km": 0.0,
                "arrived": False,
            }
            vehicle["active_route"] = "ai"
            vehicle["pos"] = ai_route["nodes"][0] if ai_route["nodes"] else vehicle["pos"]
            start_node = self.graph_manager.get_node(vehicle["pos"])
            vehicle["telemetry"]["coordinate"] = {
                "lat": round(float(start_node["lat"]), 6),
                "lng": round(float(start_node["lng"]), 6),
            }
            vehicle["telemetry"]["location_label"] = start_node["name"]
            vehicle["telemetry"]["heading_deg"] = 0.0
            vehicle["telemetry"]["status"] = "Assigned"
            vehicle["dirty_route"] = False
            vehicle["arrival_logged"] = False
        else:
            vehicle["motion"]["route_signature"] = signature

    def _current_route(self, vehicle):
        return vehicle.get("plans", {}).get(vehicle.get("active_route", "ai"), self._empty_route())

    def _effective_speed(self, vehicle, segment, event_state, weather):
        base_speed = max(10.0, float(segment.get("speed_kmh", 24.0)))
        segment_risk = float(segment.get("risk", 0.0))
        rain_penalty = 1.0 - min(0.3, float(weather.get("rain_intensity", 0.0)) * 0.35)
        risk_penalty = max(0.45, 1.0 - segment_risk / 140.0)
        fuel_penalty = 0.7 if vehicle.get("fuel", 100.0) < 18 else 0.86 if vehicle.get("fuel", 100.0) < 35 else 1.0
        event_penalties = {
            "normal": 1.0,
            "rain": 0.9,
            "light_rain": 0.94,
            "heavy_rain": 0.78,
            "flood": 0.55,
            "low_fuel": 0.82,
        }
        event_penalty = event_penalties.get(event_state, 1.0)
        return round(max(8.0, base_speed * rain_penalty * risk_penalty * fuel_penalty * event_penalty), 1)

    def _eta_speed(self, telemetry_speed_kmh, segment):
        if telemetry_speed_kmh > 0:
            return telemetry_speed_kmh
        return max(8.0, float(segment.get("speed_kmh", 24.0)) * 0.7)

    def advance_vehicle(self, vehicle, event_state, weather, frozen=False, on_arrival=None):
        self.ensure_vehicle_state(vehicle)
        route = self._current_route(vehicle)
        telemetry = vehicle["telemetry"]
        motion = vehicle["motion"]

        if not route["segments"]:
            telemetry["speed_kmh"] = 0.0
            telemetry["distance_remaining_km"] = 0.0
            telemetry["eta_minutes"] = 0.0
            telemetry["route_progress"] = 100.0 if route["nodes"] else 0.0
            telemetry["status"] = "Arrived" if route["nodes"] else "Idle"
            return

        segment_index = min(motion["segment_index"], len(route["segments"]) - 1)
        segment = route["segments"][segment_index]
        speed_kmh = self._effective_speed(vehicle, segment, event_state, weather)

        if frozen or vehicle.get("fuel", 0.0) <= 0:
            telemetry["speed_kmh"] = 0.0
            telemetry["status"] = "Holding" if frozen else "Fuel Critical"
        else:
            base_distance_km = speed_kmh * (self.tick_seconds / 3600.0)
            move_distance_km = base_distance_km * self.time_scale * SPEED_SCALE
            move_distance_km = min(move_distance_km, MAX_STEP_KM)
            remaining_move = move_distance_km
            fuel_capacity_l = float(vehicle.get("fuel_capacity_l", DEFAULT_FUEL_CAPACITY_L))

            while remaining_move > 0 and motion["segment_index"] < len(route["segments"]):
                segment_index = motion["segment_index"]
                segment = route["segments"][segment_index]
                segment_remaining_km = max(0.0, segment["distance_km"] - motion["segment_progress_km"])

                if segment_remaining_km <= 0:
                    motion["segment_index"] += 1
                    motion["segment_progress_km"] = 0.0
                    continue

                travelled = min(segment_remaining_km, remaining_move)
                motion["segment_progress_km"] += travelled
                motion["distance_travelled_km"] += travelled
                remaining_move -= travelled

                fuel_burn_l = travelled * (0.32 + float(segment.get("risk", 0.0)) / 400.0)
                vehicle["fuel"] = max(0.0, round(vehicle.get("fuel", 100.0) - (fuel_burn_l / fuel_capacity_l) * 100.0, 2))

                if motion["segment_progress_km"] >= segment["distance_km"] - 1e-6:
                    vehicle["pos"] = segment["target"]
                    motion["segment_index"] += 1
                    motion["segment_progress_km"] = 0.0

            telemetry["speed_kmh"] = speed_kmh
            telemetry["status"] = "En Route"

        finished = motion["segment_index"] >= len(route["segments"])
        if finished:
            final_coord = route["coordinates"][-1]
            telemetry["coordinate"] = {
                "lat": final_coord["lat"],
                "lng": final_coord["lng"],
            }
            telemetry["location_label"] = final_coord["name"]
            telemetry["heading_deg"] = telemetry.get("heading_deg", 0.0)
            telemetry["speed_kmh"] = 0.0 if frozen else telemetry["speed_kmh"]
            telemetry["distance_remaining_km"] = 0.0
            telemetry["eta_minutes"] = 0.0
            telemetry["route_progress"] = 100.0
            telemetry["status"] = "Arrived"
            motion["arrived"] = True
            if on_arrival and not vehicle.get("arrival_logged"):
                on_arrival(vehicle["id"])
                vehicle["arrival_logged"] = True
        else:
            segment_index = min(motion["segment_index"], len(route["segments"]) - 1)
            segment = route["segments"][segment_index]
            ratio = 0.0
            if segment["distance_km"] > 0:
                ratio = min(1.0, motion["segment_progress_km"] / segment["distance_km"])
            telemetry["coordinate"] = interpolate_coord(segment["start"], segment["end"], ratio)
            telemetry["location_label"] = f"{segment['source_name']} -> {segment['target_name']}"
            telemetry["heading_deg"] = bearing_degrees(segment["start"], segment["end"])
            remaining_distance = max(0.0, route["summary"]["distance_km"] - motion["distance_travelled_km"])
            telemetry["distance_remaining_km"] = round(remaining_distance, 2)
            eta_speed_kmh = self._eta_speed(telemetry["speed_kmh"], segment)
            telemetry["eta_minutes"] = round((remaining_distance / eta_speed_kmh) * 60.0, 1)
            telemetry["route_progress"] = round(
                min(100.0, motion["distance_travelled_km"] / max(route["summary"]["distance_km"], 0.1) * 100.0),
                1,
            )

        active_risk = 0.0 if finished else float(segment.get("risk", 0.0))
        telemetry["risk_exposure"] = round(active_risk, 1)
        telemetry["risk_status"] = risk_status(active_risk, vehicle.get("fuel", 100.0))
        telemetry["fuel_percent"] = round(vehicle.get("fuel", 100.0), 1)
        telemetry["fuel_liters"] = round(vehicle.get("fuel", 100.0) / 100.0 * vehicle.get("fuel_capacity_l", DEFAULT_FUEL_CAPACITY_L), 1)

    def build_vehicle_payload(
        self,
        vehicle,
        ai_data,
        baseline_time,
        true_baseline_time,
        rejected_reason,
        sla_breached,
        priority=None,
        sla_deadline=None,
        sla_remaining_mins=None,
    ):
        ai_route = vehicle["plans"]["ai"]
        baseline_route = vehicle["plans"]["baseline"]
        ai_optimal = ai_data.get("optimal", {})

        return {
            "id": vehicle["id"],
            "label": vehicle.get("label", vehicle["id"]),
            "color": vehicle.get("color", "#58a6ff"),
            "pos": vehicle["pos"],
            "target": vehicle["target"],
            "position": vehicle["telemetry"]["coordinate"],
            "speed": vehicle["telemetry"]["speed_kmh"],
            "stops": vehicle.get("stops", []),
            "fuel": round(vehicle.get("fuel", 100.0), 1),
            "dispatched": vehicle.get("dispatched", False),
            "priority": priority,
            "sla_deadline": sla_deadline,
            "sla_remaining_mins": sla_remaining_mins,
            "route": ai_route["coordinates"],
            "telemetry": vehicle["telemetry"],
            "truck_profile": vehicle.get("truck_profile", {}),
            "baseline": {
                "path": baseline_route["nodes"],
                "coordinates": baseline_route["coordinates"],
                "projected_time": round(float(baseline_time), 1),
                "true_time": round(float(true_baseline_time), 1),
                "rejected_reason": rejected_reason,
                "sla_breached": sla_breached,
                "max_risk": baseline_route["summary"]["max_risk"],
                "distance_km": baseline_route["summary"]["distance_km"],
                "fuel_est_l": baseline_route["summary"]["fuel_est_l"],
            },
            "ai": {
                "path": ai_route["nodes"],
                "coordinates": ai_route["coordinates"],
                "predicted_time": ai_optimal.get("time", ai_route["summary"]["projected_time"]),
                "distance_km": ai_route["summary"]["distance_km"],
                "avg_risk": ai_route["summary"]["avg_risk"],
                "max_risk": ai_optimal.get("risk", ai_route["summary"]["max_risk"]),
                "fuel_est_l": ai_route["summary"]["fuel_est_l"],
                "reason": ai_optimal.get("reason", "AI route generated."),
                "rejected_reason": ai_optimal.get("rejected_reason", ""),
                "time_saved": round(max(0.0, true_baseline_time - float(ai_optimal.get("time", 0.0))), 1),
                "confidence": ai_optimal.get("confidence", 0),
                "policy": ai_optimal.get("policy", "RiskAwareRouter"),
                "q_value": round(-ai_data.get("cost_function", {}).get("score", 0.0), 2),
                "routing_mode": ai_data.get("routing_mode", "BALANCED"),
                "selected_weights": ai_data.get("selected_weights", {}),
                "decision_reason": ai_data.get("decision_reason", "Using BALANCED mode by default."),
                "cost_function": ai_data.get("cost_function", {}),
                "alternatives": ai_data.get("alternatives", []),
            },
        }

    def build_business_metrics(self, vehicles, dispatch_count, completed_deliveries):
        if not vehicles:
            return {
                "cost_saved": 0,
                "deliveries_completed": completed_deliveries,
                "dispatch_count": dispatch_count,
                "sla_breached_baseline": 0,
                "efficiency_percentage": 0.0,
                "average_fuel": 0.0,
                "average_risk": 0.0,
                "fleet_load_utilization": 0.0,
            }

        total_ai_time = sum(v["ai"]["predicted_time"] for v in vehicles)
        total_baseline_time = sum(v["baseline"]["true_time"] for v in vehicles)
        total_ai_fuel = sum(v["ai"]["fuel_est_l"] for v in vehicles)
        total_baseline_fuel = sum(v["baseline"]["fuel_est_l"] for v in vehicles)

        time_saved = max(0.0, total_baseline_time - total_ai_time)
        fuel_saved = max(0.0, total_baseline_fuel - total_ai_fuel)
        efficiency = 0.0
        if total_baseline_time > 0:
            efficiency = round((1 - total_ai_time / total_baseline_time) * 100, 1)

        avg_fuel = round(sum(v["fuel"] for v in vehicles) / len(vehicles), 1)
        avg_risk = round(sum(v["telemetry"]["risk_exposure"] for v in vehicles) / len(vehicles), 1)
        avg_utilization = round(
            sum(
                v.get("truck_profile", {})
                .get("optimization_metrics", {})
                .get("box_utilization_pct", 0.0)
                for v in vehicles
            ) / len(vehicles),
            1,
        )

        return {
            "cost_saved": int(time_saved * 85 + fuel_saved * 120),
            "deliveries_completed": completed_deliveries,
            "dispatch_count": dispatch_count,
            "sla_breached_baseline": sum(1 for v in vehicles if v["baseline"]["sla_breached"]),
            "efficiency_percentage": efficiency,
            "average_fuel": avg_fuel,
            "average_risk": avg_risk,
            "fleet_load_utilization": avg_utilization,
            "fuel_saved_l": round(fuel_saved, 1),
            "time_saved_min": round(time_saved, 1),
        }
