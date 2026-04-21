"""
weather_feed.py
Fetches real-time Mumbai weather from the Open-Meteo free API.
No API key or registration required.
Results are cached for 300 seconds so the system works offline
if the network is briefly unreachable.
"""

import time

import requests

DEFAULT_WEATHER = {
    "rain_intensity": 0.0,
    "wind_factor": 0.0,
    "is_storm": False,
    "source": "fallback",
}

_cache = {"data": dict(DEFAULT_WEATHER), "timestamp": 0}
TTL = 300
REQUEST_TIMEOUT_SECONDS = 0.35


def get_weather_features():
    now = time.time()
    if now - _cache["timestamp"] < TTL:
        return _cache["data"]
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": 19.07,
                "longitude": 72.87,
                "current": "rain,wind_speed_10m,weather_code",
                "timezone": "Asia/Kolkata"
            },
            timeout=REQUEST_TIMEOUT_SECONDS
        )
        current = r.json()["current"]
        rain = current.get("rain", 0.0) or 0.0
        wind = current.get("wind_speed_10m", 0.0)
        code = current.get("weather_code", 0)
        result = {
            "rain_intensity": min(rain / 20.0, 1.0),
            "wind_factor": min(wind / 60.0, 1.0),
            "is_storm": code >= 95,
            "source": "open-meteo",
        }
        _cache["data"] = result
        _cache["timestamp"] = now
        return result
    except Exception:
        _cache["data"] = dict(DEFAULT_WEATHER)
        _cache["timestamp"] = now
        return _cache["data"]
