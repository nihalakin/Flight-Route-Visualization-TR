"""
Havalimanı verileri için public (auth istemeyen) endpointler.
Frontend harita ve liste sayfaları bu uç noktadan veritabanındaki airports
tablosuna erişir.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Airport

router = APIRouter(prefix="/airports", tags=["airports"])


@router.get("", response_model=list[dict])
async def list_airports_public(db: Session = Depends(get_db)) -> list[dict]:
    """
    Tüm havalimanlarını (Airport) listeler.
    Auth gerektirmez; yalnızca read-only kullanım içindir.
    """
    airports = db.query(Airport).order_by(Airport.city.asc(), Airport.name.asc()).all()
    results: list[dict] = []
    for a in airports:
        results.append(
            {
                "id": a.id,
                "name": a.name,
                "city": a.city,
                "iata": a.iata,
                "icao": a.icao,
                "type": a.type,
                "year": a.year,
                "lat": a.lat,
                "lon": a.lon,
                "region": a.region,
                "flights": a.flights,
            }
        )
    return results

