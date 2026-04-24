from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
import sys
from time import perf_counter

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.models.router import RiskAwareRouter


SAMPLE_EDGES = [
    {"source": "A", "target": "B", "weight": 20, "risk": 10},
    {"source": "B", "target": "C", "weight": 20, "risk": 10},
    {"source": "A", "target": "D", "weight": 6, "risk": 30},
    {"source": "D", "target": "C", "weight": 6, "risk": 30},
]

ITERATIONS = 500
THRESHOLD_MS = 5.0


def main():
    router = RiskAwareRouter()
    now = datetime.now(timezone.utc)
    samples_ms = []

    contexts = [
        {},
        {"priority": "HIGH"},
        {"priority": "LOW"},
        {"sla_deadline": 15, "dispatch_reference_utc": now},
        {"sla_deadline": (now + timedelta(minutes=10)).isoformat()},
        {"priority": "HIGH", "fuel_level": 10},
    ]

    for _ in range(ITERATIONS):
        for context in contexts:
            started = perf_counter()
            router.get_ai_route(
                SAMPLE_EDGES,
                "A",
                "C",
                current_time_utc=now,
                **context,
            )
            samples_ms.append((perf_counter() - started) * 1000.0)

    average_ms = mean(samples_ms)
    p95_ms = sorted(samples_ms)[int(len(samples_ms) * 0.95)]
    max_ms = max(samples_ms)

    print(f"Average route latency: {average_ms:.3f} ms")
    print(f"P95 route latency: {p95_ms:.3f} ms")
    print(f"Max route latency: {max_ms:.3f} ms")

    if average_ms > THRESHOLD_MS:
        raise SystemExit(
            f"Average route latency {average_ms:.3f} ms exceeds {THRESHOLD_MS:.1f} ms threshold."
        )


if __name__ == "__main__":
    main()
