"""
Amadeus API: token ve uçuş arama.
"""
import httpx
from fastapi import HTTPException

from app.core.config import AMADEUS_API_KEY, AMADEUS_API_SECRET

TOKEN_URL = "https://test.api.amadeus.com/v1/security/oauth2/token"
FLIGHT_OFFERS_URL = "https://test.api.amadeus.com/v2/shopping/flight-offers"


async def get_access_token() -> str:
    """Amadeus API için access token al."""
    data = {
        "grant_type": "client_credentials",
        "client_id": AMADEUS_API_KEY,
        "client_secret": AMADEUS_API_SECRET,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(TOKEN_URL, data=data)
    if response.status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"Token alma hatası: {response.status_code}",
        )
    return response.json()["access_token"]


async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
    travel_class: str = "ECONOMY",
    currency_code: str = "TRY",
    max_results: int = 10,
) -> dict:
    """Amadeus Flight Offers API ile uçuş ara."""
    token = await get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "originLocationCode": origin,
        "destinationLocationCode": destination,
        "departureDate": departure_date,
        "adults": adults,
        "travelClass": travel_class,
        "currencyCode": currency_code,
        "max": max_results,
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(
            FLIGHT_OFFERS_URL,
            headers=headers,
            params=params,
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"API hatası: {response.text}",
        )
    return response.json()
