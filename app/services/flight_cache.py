"""
Amadeus uçuş arama önbelleği — API kesildiğinde offline yanıt için.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_PATH = ROOT / "data" / "flight_cache.json"

DATE_RANGE_START = "2026-06-15"
DATE_RANGE_END = "2026-06-30"


def _cache_key(origin: str, destination: str, departure_date: str) -> str:
    return f"{origin.upper()}|{destination.upper()}|{departure_date}"


def load_cache() -> dict[str, Any]:
    if not CACHE_PATH.exists():
        return {"meta": {}, "queries": {}}
    with CACHE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CACHE_PATH.open("w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def get_cached_response(
    origin: str,
    destination: str,
    departure_date: str,
) -> dict[str, Any] | None:
    """Başarılı önbellek kaydı varsa ham Amadeus yanıtını döner."""
    cache = load_cache()
    entry = cache.get("queries", {}).get(
        _cache_key(origin, destination, departure_date)
    )
    if not entry or entry.get("error"):
        return None
    response = entry.get("response")
    if isinstance(response, dict) and response.get("data") is not None:
        return response
    if isinstance(response, dict):
        return response
    return None


def is_date_in_cache_range(departure_date: str) -> bool:
    return DATE_RANGE_START <= departure_date <= DATE_RANGE_END
