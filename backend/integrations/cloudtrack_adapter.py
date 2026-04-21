import importlib.util
from functools import lru_cache
from pathlib import Path


FALLBACK_TRUCKS = [
    {"name": "12-ft Truck", "length": 3.66, "width": 2.0, "height": 2.0, "max_weight": 3000},
    {"name": "24-ft Truck", "length": 7.32, "width": 2.44, "height": 2.6, "max_weight": 8000},
    {"name": "32-ft Truck", "length": 9.75, "width": 2.44, "height": 2.6, "max_weight": 10000},
]


def _default_capacity(length, width, height, box_length, box_width, box_height):
    return (
        int(length // box_length)
        * int(width // box_width)
        * int(height // box_height)
    )


class CloudtrackOptimizerAdapter:
    """
    Integrates truck capacity and loading heuristics from the external
    Cloudtrack_Optimizor repository into the unified platform.
    """

    def __init__(self):
        self.repo_root = Path(__file__).resolve().parents[2]
        self.module = self._load_external_module()

        self.box_length = getattr(self.module, "BOX_LENGTH", 0.46)
        self.box_width = getattr(self.module, "BOX_WIDTH", 0.46)
        self.box_height = getattr(self.module, "BOX_HEIGHT", 0.41)
        self.box_weight = getattr(self.module, "BOX_WEIGHT", 12)
        self.box_volume = getattr(
            self.module,
            "BOX_VOLUME",
            self.box_length * self.box_width * self.box_height,
        )
        self.truck_specs = getattr(self.module, "TRUCKS", FALLBACK_TRUCKS)
        self.capacity_fn = getattr(
            self.module,
            "calculate_max_capacity",
            lambda l, w, h: _default_capacity(
                l, w, h, self.box_length, self.box_width, self.box_height
            ),
        )

    def _load_external_module(self):
        module_path = self.repo_root / "external" / "cloudtrack" / "Algorithm" / "truckFilling.py"
        if not module_path.exists():
            return None

        spec = importlib.util.spec_from_file_location("cloudtrack_truck_filling", module_path)
        if spec is None or spec.loader is None:
            return None

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    @lru_cache(maxsize=8)
    def get_truck_catalog(self):
        catalog = []
        for truck in self.truck_specs:
            capacity = int(
                truck.get(
                    "maximum_capacity",
                    self.capacity_fn(truck["length"], truck["width"], truck["height"]),
                )
            )
            catalog.append({
                "name": truck["name"],
                "length_m": float(truck["length"]),
                "width_m": float(truck["width"]),
                "height_m": float(truck["height"]),
                "max_weight_kg": float(truck["max_weight"]),
                "box_capacity": capacity,
                "volume_m3": round(float(truck["length"] * truck["width"] * truck["height"]), 2),
            })
        catalog.sort(key=lambda item: (item["box_capacity"], item["max_weight_kg"]))
        return catalog

    def build_manifest(self, stops, route_nodes):
        priority_weight = {"high": 3, "medium": 2, "low": 1}
        urgency_pressure = 0
        priority_pressure = 0
        for stop in stops or []:
            priority = str(stop.get("priority", "medium")).strip().lower()
            deadline = int(stop.get("deadline_mins", 60))
            priority_pressure += priority_weight.get(priority, 2) * 3
            urgency_pressure += max(0, 90 - deadline) // 6

        waypoint_pressure = max(0, len(route_nodes or []) - 2) * 2
        stop_pressure = len(stops or []) * 7
        estimated_boxes = max(8, stop_pressure + priority_pressure + urgency_pressure + waypoint_pressure)
        estimated_weight_kg = round(estimated_boxes * self.box_weight, 1)
        estimated_volume_m3 = round(estimated_boxes * self.box_volume, 2)
        return {
            "estimated_boxes": estimated_boxes,
            "estimated_weight_kg": estimated_weight_kg,
            "estimated_volume_m3": estimated_volume_m3,
        }

    def assign_truck_profile(self, vehicle_id, stops, route_nodes):
        manifest = self.build_manifest(stops, route_nodes)
        truck = self.get_truck_catalog()[-1]
        for candidate in self.get_truck_catalog():
            if (
                candidate["box_capacity"] >= manifest["estimated_boxes"]
                and candidate["max_weight_kg"] >= manifest["estimated_weight_kg"]
            ):
                truck = candidate
                break

        weight_pct = min(100.0, round(manifest["estimated_weight_kg"] / truck["max_weight_kg"] * 100, 1))
        volume_pct = min(100.0, round(manifest["estimated_volume_m3"] / truck["volume_m3"] * 100, 1))
        box_pct = min(100.0, round(manifest["estimated_boxes"] / truck["box_capacity"] * 100, 1))
        dominant = max(weight_pct, volume_pct, box_pct)

        if dominant >= 85:
            load_class = "High Utilization"
        elif dominant >= 55:
            load_class = "Balanced"
        else:
            load_class = "Light"

        return {
            "source": "cloudtrack",
            "vehicle_id": vehicle_id,
            "truck_name": truck["name"],
            "dimensions": {
                "length_m": truck["length_m"],
                "width_m": truck["width_m"],
                "height_m": truck["height_m"],
            },
            "capacity": {
                "max_weight_kg": truck["max_weight_kg"],
                "box_capacity": truck["box_capacity"],
                "volume_m3": truck["volume_m3"],
            },
            "manifest": manifest,
            "optimization_metrics": {
                "weight_utilization_pct": weight_pct,
                "volume_utilization_pct": volume_pct,
                "box_utilization_pct": box_pct,
                "load_class": load_class,
            },
        }
