"""
Amadeus Flight API'den 15-30 Haziran 2026 aralığı için toplu uçuş verisi çeker
ve data/flight_cache.json dosyasına kaydeder.

Kullanım (proje kökünden):
    python scripts/bulk_fetch_amadeus_flights.py
    python scripts/bulk_fetch_amadeus_flights.py --min-queries 200
    python scripts/bulk_fetch_amadeus_flights.py --max-queries 300
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import AMADEUS_API_KEY, AMADEUS_API_SECRET
from app.services.flight_cache import CACHE_PATH, save_cache

TOKEN_URL = "https://test.api.amadeus.com/v1/security/oauth2/token"
FLIGHT_OFFERS_URL = "https://test.api.amadeus.com/v2/shopping/flight-offers"

DATE_START = date(2026, 6, 15)
DATE_END = date(2026, 6, 30)
AIRPORT_JSON = ROOT / "data" / "airport.json"


def _dates_in_range_fixed() -> list[str]:
    result = []
    d = DATE_START
    while d <= DATE_END:
        result.append(d.isoformat())
        d = date.fromordinal(d.toordinal() + 1)
    return result


def load_routes() -> list[tuple[str, str]]:
    with AIRPORT_JSON.open(encoding="utf-8") as f:
        data = json.load(f)
    routes: set[tuple[str, str]] = set()
    for airport in data.get("airports", []):
        origin = (airport.get("iata") or "").strip().upper()
        if len(origin) != 3:
            continue
        raw = airport.get("flights") or ""
        for dest in raw.split(";"):
            dest = dest.strip().upper()
            if len(dest) == 3 and dest != origin:
                routes.add((origin, dest))
    return sorted(routes)


def build_query_list() -> list[tuple[str, str, str]]:
    routes = load_routes()
    dates = _dates_in_range_fixed()
    return [(o, d, dt) for o, d in routes for dt in dates]


def _cache_key(origin: str, destination: str, departure_date: str) -> str:
    return f"{origin}|{destination}|{departure_date}"


def load_existing_cache() -> dict:
    if CACHE_PATH.exists():
        with CACHE_PATH.open(encoding="utf-8") as f:
            return json.load(f)
    return {
        "meta": {
            "date_range": {"start": DATE_START.isoformat(), "end": DATE_END.isoformat()},
            "source": "amadeus_test_api",
        },
        "queries": {},
    }


class AmadeusFetcher:
    def __init__(self, delay_sec: float = 0.35):
        self.delay_sec = delay_sec
        self._token: str | None = None
        self._token_expires_at: float = 0

    async def _ensure_token(self, client: httpx.AsyncClient) -> str:
        if self._token and time.time() < self._token_expires_at - 30:
            return self._token
        data = {
            "grant_type": "client_credentials",
            "client_id": AMADEUS_API_KEY,
            "client_secret": AMADEUS_API_SECRET,
        }
        resp = await client.post(TOKEN_URL, data=data)
        if resp.status_code != 200:
            raise RuntimeError(f"Token hatası {resp.status_code}: {resp.text[:300]}")
        body = resp.json()
        self._token = body["access_token"]
        self._token_expires_at = time.time() + int(body.get("expires_in", 1799))
        return self._token

    async def search(
        self,
        client: httpx.AsyncClient,
        origin: str,
        destination: str,
        departure_date: str,
        max_results: int = 50,
    ) -> tuple[dict | None, str | None]:
        for attempt in range(4):
            try:
                token = await self._ensure_token(client)
                params = {
                    "originLocationCode": origin,
                    "destinationLocationCode": destination,
                    "departureDate": departure_date,
                    "adults": 1,
                    "travelClass": "ECONOMY",
                    "currencyCode": "TRY",
                    "max": max_results,
                }
                resp = await client.get(
                    FLIGHT_OFFERS_URL,
                    headers={"Authorization": f"Bearer {token}"},
                    params=params,
                    timeout=60.0,
                )
                if resp.status_code == 429:
                    wait = 30 * (attempt + 1)
                    print(f"  Rate limit — {wait}s bekleniyor...")
                    await asyncio.sleep(wait)
                    continue
                if resp.status_code == 401:
                    self._token = None
                    await asyncio.sleep(2)
                    continue
                if resp.status_code != 200:
                    return None, f"HTTP {resp.status_code}: {resp.text[:500]}"
                return resp.json(), None
            except httpx.RequestError as e:
                if attempt < 3:
                    await asyncio.sleep(5 * (attempt + 1))
                    continue
                return None, str(e)
        return None, "Maksimum deneme sayısı aşıldı"


async def run_bulk_fetch(
    min_queries: int,
    max_queries: int | None,
    skip_existing: bool,
) -> None:
    if not AMADEUS_API_KEY or not AMADEUS_API_SECRET:
        print("HATA: .env dosyasında AMADEUS_API_KEY ve AMADEUS_API_SECRET tanımlı olmalı.")
        sys.exit(1)

    all_queries = build_query_list()
    print(f"Toplam planlanan sorgu: {len(all_queries)} (rota × tarih)")

    cache = load_existing_cache()
    queries_map = cache.setdefault("queries", {})

    successful = sum(
        1 for e in queries_map.values()
        if not e.get("error") and e.get("response")
    )
    failed = sum(1 for e in queries_map.values() if e.get("error"))
    attempted = len(queries_map)

    fetcher = AmadeusFetcher()
    new_fetches = 0

    async with httpx.AsyncClient() as client:
        for origin, destination, departure_date in all_queries:
            if max_queries is not None and new_fetches >= max_queries:
                break

            key = _cache_key(origin, destination, departure_date)
            existing = queries_map.get(key)
            if skip_existing and existing and not existing.get("error") and existing.get("response"):
                continue

            print(f"[yeni #{new_fetches + 1}] {origin} -> {destination} @ {departure_date} ...")
            response, error = await fetcher.search(
                client, origin, destination, departure_date
            )

            entry = {
                "origin": origin,
                "destination": destination,
                "departure_date": departure_date,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "params": {
                    "adults": 1,
                    "travelClass": "ECONOMY",
                    "currencyCode": "TRY",
                    "max": 50,
                },
                "response": response,
                "error": error,
                "offer_count": len((response or {}).get("data", [])) if response else 0,
            }
            queries_map[key] = entry
            attempted = len(queries_map)
            new_fetches += 1

            if error:
                failed += 1
                print(f"  HATA: {error[:120]}")
            else:
                successful += 1
                print(f"  OK — {entry['offer_count']} teklif")

            cache["meta"] = {
                "date_range": {"start": DATE_START.isoformat(), "end": DATE_END.isoformat()},
                "source": "amadeus_test_api",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "total_queries": attempted,
                "successful_queries": successful,
                "failed_queries": failed,
            }
            save_cache(cache)
            await asyncio.sleep(fetcher.delay_sec)

    cache["meta"] = {
        "date_range": {"start": DATE_START.isoformat(), "end": DATE_END.isoformat()},
        "source": "amadeus_test_api",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total_queries": len(queries_map),
        "successful_queries": successful,
        "failed_queries": failed,
    }
    save_cache(cache)

    print("\n--- Özet ---")
    print(f"Kayıt dosyası: {CACHE_PATH}")
    print(f"Toplam kayıt: {len(queries_map)}")
    print(f"Başarılı: {successful}")
    print(f"Hatalı: {failed}")
    if successful < min_queries:
        print(f"UYARI: Hedef en az {min_queries} başarılı sorgu — elde edilen: {successful}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Amadeus uçuş verisi toplu çekim")
    parser.add_argument("--min-queries", type=int, default=200, help="En az başarılı sorgu hedefi")
    parser.add_argument(
        "--max-queries",
        type=int,
        default=None,
        help="Bu çalıştırmada yapılacak yeni API çağrısı üst sınırı",
    )
    parser.add_argument(
        "--no-skip-existing",
        action="store_true",
        help="Önbellekteki başarılı kayıtları yeniden çek",
    )
    args = parser.parse_args()
    asyncio.run(
        run_bulk_fetch(
            min_queries=args.min_queries,
            max_queries=args.max_queries,
            skip_existing=not args.no_skip_existing,
        )
    )


if __name__ == "__main__":
    main()
