from datetime import datetime, timedelta, timezone
import unittest

from backend.models.router import (
    BALANCED_WEIGHTS,
    FASTEST_WEIGHTS,
    FUEL_OVERRIDE_WEIGHTS,
    SAFEST_WEIGHTS,
    RiskAwareRouter,
)
from backend.tracking.tracker import Tracker


SAMPLE_EDGES = [
    {"source": "A", "target": "B", "weight": 20, "risk": 10},
    {"source": "B", "target": "C", "weight": 20, "risk": 10},
    {"source": "A", "target": "D", "weight": 6, "risk": 30},
    {"source": "D", "target": "C", "weight": 6, "risk": 30},
]


class AdaptiveRouterTests(unittest.TestCase):
    def setUp(self):
        self.router = RiskAwareRouter()
        self.now = datetime(2026, 4, 24, 12, 0, tzinfo=timezone.utc)

    def test_default_balanced_when_priority_and_sla_missing(self):
        result = self.router.get_ai_route(
            SAMPLE_EDGES,
            "A",
            "C",
            current_time_utc=self.now,
        )

        self.assertEqual(result["routing_mode"], "BALANCED")
        self.assertEqual(result["selected_weights"], BALANCED_WEIGHTS)
        self.assertEqual(result["optimal"]["path"], ["A", "B", "C"])
        self.assertIn("BALANCED", result["decision_reason"])

    def test_high_priority_switches_to_fastest(self):
        result = self.router.get_ai_route(
            SAMPLE_EDGES,
            "A",
            "C",
            priority="HIGH",
            current_time_utc=self.now,
        )

        self.assertEqual(result["routing_mode"], "FASTEST")
        self.assertEqual(result["selected_weights"], FASTEST_WEIGHTS)
        self.assertEqual(result["optimal"]["path"], ["A", "D", "C"])

    def test_low_priority_switches_to_safest(self):
        result = self.router.get_ai_route(
            SAMPLE_EDGES,
            "A",
            "C",
            priority="LOW",
            current_time_utc=self.now,
        )

        self.assertEqual(result["routing_mode"], "SAFEST")
        self.assertEqual(result["selected_weights"], SAFEST_WEIGHTS)
        self.assertEqual(result["optimal"]["path"], ["A", "B", "C"])

    def test_numeric_sla_below_threshold_switches_to_fastest(self):
        result = self.router.get_ai_route(
            SAMPLE_EDGES,
            "A",
            "C",
            sla_deadline=15,
            dispatch_reference_utc=self.now,
            current_time_utc=self.now,
        )

        self.assertEqual(result["routing_mode"], "FASTEST")
        self.assertEqual(result["selected_weights"], FASTEST_WEIGHTS)
        self.assertEqual(result["sla_remaining_mins"], 15.0)

    def test_iso_sla_below_threshold_switches_to_fastest(self):
        result = self.router.get_ai_route(
            SAMPLE_EDGES,
            "A",
            "C",
            sla_deadline=(self.now + timedelta(minutes=10)).isoformat(),
            current_time_utc=self.now,
        )

        self.assertEqual(result["routing_mode"], "FASTEST")
        self.assertEqual(result["selected_weights"], FASTEST_WEIGHTS)
        self.assertEqual(result["sla_remaining_mins"], 10.0)

    def test_critical_fuel_override_keeps_balanced_label(self):
        result = self.router.get_ai_route(
            SAMPLE_EDGES,
            "A",
            "C",
            priority="HIGH",
            sla_deadline=5,
            dispatch_reference_utc=self.now,
            fuel_level=10,
            current_time_utc=self.now,
        )

        self.assertEqual(result["routing_mode"], "BALANCED")
        self.assertEqual(result["selected_weights"], FUEL_OVERRIDE_WEIGHTS)
        self.assertIn("fuel", result["decision_reason"].lower())

    def test_invalid_sla_falls_back_cleanly(self):
        result = self.router.get_ai_route(
            SAMPLE_EDGES,
            "A",
            "C",
            sla_deadline="not-a-date",
            current_time_utc=self.now,
        )

        self.assertEqual(result["routing_mode"], "BALANCED")
        self.assertEqual(result["selected_weights"], BALANCED_WEIGHTS)
        self.assertIsNone(result["sla_remaining_mins"])

    def test_vehicle_payload_contains_adaptive_metadata(self):
        tracker = Tracker(None, None)
        vehicle = {
            "id": "V1",
            "label": "Monsoon-01",
            "color": "#58a6ff",
            "pos": "A",
            "target": "C",
            "fuel": 80.0,
            "dispatched": True,
            "stops": [],
            "telemetry": {
                "coordinate": {"lat": 19.1197, "lng": 72.8464},
                "speed_kmh": 0.0,
            },
            "plans": {
                "ai": {
                    "nodes": ["A", "D", "C"],
                    "coordinates": [],
                    "summary": {
                        "projected_time": 12.0,
                        "distance_km": 5.0,
                        "avg_risk": 30.0,
                        "max_risk": 30.0,
                        "fuel_est_l": 2.0,
                    },
                },
                "baseline": {
                    "nodes": ["A", "B", "C"],
                    "coordinates": [],
                    "summary": {
                        "projected_time": 20.0,
                        "distance_km": 7.0,
                        "avg_risk": 10.0,
                        "max_risk": 10.0,
                        "fuel_est_l": 3.0,
                    },
                },
            },
        }
        ai_data = {
            "optimal": {
                "path": ["A", "D", "C"],
                "time": 12.0,
                "risk": 30.0,
                "confidence": 70,
                "reason": "AI route generated.",
                "rejected_reason": "Rejected baseline.",
                "policy": "RiskAwareRouter",
            },
            "alternatives": [],
            "cost_function": {"score": 11.5},
            "routing_mode": "FASTEST",
            "selected_weights": FASTEST_WEIGHTS,
            "decision_reason": "Switched to FASTEST mode due to HIGH priority.",
        }

        payload = tracker.build_vehicle_payload(
            vehicle=vehicle,
            ai_data=ai_data,
            baseline_time=20.0,
            true_baseline_time=22.0,
            rejected_reason="Rejected baseline.",
            sla_breached=False,
            priority="HIGH",
            sla_deadline=15,
            sla_remaining_mins=14.5,
        )

        self.assertEqual(payload["priority"], "HIGH")
        self.assertEqual(payload["sla_deadline"], 15)
        self.assertEqual(payload["sla_remaining_mins"], 14.5)
        self.assertEqual(payload["ai"]["routing_mode"], "FASTEST")
        self.assertEqual(payload["ai"]["selected_weights"], FASTEST_WEIGHTS)
        self.assertIn("decision_reason", payload["ai"])


if __name__ == "__main__":
    unittest.main()
