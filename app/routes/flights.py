"""
Uçuş arama API endpoint'leri.
"""
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.services import amadeus
from app.services.flight_cache import get_cached_response, is_date_in_cache_range

router = APIRouter(prefix="/flights", tags=["flights"])


@router.get("", response_model=dict[str, Any])
async def search_flights(
    origin: str = Query(..., description="Kalkış havalimanı (IATA)", min_length=3, max_length=3),
    destination: str = Query(..., description="Varış havalimanı (IATA)", min_length=3, max_length=3),
    departure_date: str = Query(..., description="Kalkış tarihi (YYYY-MM-DD)", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    adults: int = Query(1, ge=1, le=9),
    max_results: int = Query(10, ge=1, le=50),
    travel_class: str = Query(
        "ECONOMY",
        pattern="^(ECONOMY|PREMIUM_ECONOMY|BUSINESS|FIRST)$",
    ),
    currency_code: str = Query("TRY", pattern="^[A-Z]{3}$"),
):
    """
    Amadeus API ile uçuş arama.
    - **origin**: Örn. IST
    - **destination**: Örn. LHR
    - **departure_date**: YYYY-MM-DD
    """
    try:
        return await amadeus.search_flights(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            adults=adults,
            travel_class=travel_class,
            currency_code=currency_code,
            max_results=max_results,
        )
    except HTTPException:
        if is_date_in_cache_range(departure_date):
            cached = get_cached_response(origin, destination, departure_date)
            if cached is not None:
                return cached
        raise
    except httpx.RequestError as e:
        if is_date_in_cache_range(departure_date):
            cached = get_cached_response(origin, destination, departure_date)
            if cached is not None:
                return cached
        raise HTTPException(status_code=500, detail=f"HTTP isteği hatası: {str(e)}")
