from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AnnualAirTraffic,
    AnnualCargoTraffic,
    AnnualPassengerTraffic,
    AnnualFreightTraffic,
    User,
)
from app.routes.auth import get_current_admin


router = APIRouter(prefix="/statistics", tags=["statistics"])


class AirTrafficUpdate(BaseModel):
    tüm_uçak_overflight_dahil: float | None = None
    uçak_trafiği: float | None = None
    iç_hat: float | None = None
    dış_hat: float | None = None
    overflight_uçak_trafiği: float | None = None


class CargoTrafficUpdate(BaseModel):
    kargo_trafiği_ton: float | None = None
    iç_hat_kargo_ton: float | None = None
    dış_hat_kargo_ton: float | None = None


class PassengerTrafficUpdate(BaseModel):
    yolcu_trafiği_transit_dahil: float | None = None
    yolcu_trafiği: float | None = None
    iç_hat: float | None = None
    dış_hat: float | None = None
    direkt_transit: float | None = None


class FreightTrafficUpdate(BaseModel):
    yük_trafiği_ton: float | None = None
    iç_hat_ton: float | None = None
    dış_hat_ton: float | None = None


@router.get("/air-traffic", response_model=list[dict])
async def list_air_traffic(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.query(AnnualAirTraffic).order_by(AnnualAirTraffic.yil.asc()).all()
    return [
        {
            "yil": r.yil,
            "tüm_uçak_overflight_dahil": r.tüm_uçak_overflight_dahil,
            "uçak_trafiği": r.uçak_trafiği,
            "iç_hat": r.iç_hat,
            "dış_hat": r.dış_hat,
            "overflight_uçak_trafiği": r.overflight_uçak_trafiği,
        }
        for r in rows
    ]


@router.get("/cargo-traffic", response_model=list[dict])
async def list_cargo_traffic(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.query(AnnualCargoTraffic).order_by(AnnualCargoTraffic.yil.asc()).all()
    return [
        {
            "yil": r.yil,
            "kargo_trafiği_ton": r.kargo_trafiği_ton,
            "iç_hat_kargo_ton": r.iç_hat_kargo_ton,
            "dış_hat_kargo_ton": r.dış_hat_kargo_ton,
        }
        for r in rows
    ]


@router.get("/passenger-traffic", response_model=list[dict])
async def list_passenger_traffic(db: Session = Depends(get_db)) -> list[dict]:
    rows = (
        db.query(AnnualPassengerTraffic).order_by(AnnualPassengerTraffic.yil.asc()).all()
    )
    return [
        {
            "yil": r.yil,
            "yolcu_trafiği_transit_dahil": r.yolcu_trafiği_transit_dahil,
            "yolcu_trafiği": r.yolcu_trafiği,
            "iç_hat": r.iç_hat,
            "dış_hat": r.dış_hat,
            "direkt_transit": r.direkt_transit,
        }
        for r in rows
    ]


@router.get("/freight-traffic", response_model=list[dict])
async def list_freight_traffic(db: Session = Depends(get_db)) -> list[dict]:
    rows = (
        db.query(AnnualFreightTraffic).order_by(AnnualFreightTraffic.yil.asc()).all()
    )
    return [
        {
            "yil": r.yil,
            "yük_trafiği_ton": r.yük_trafiği_ton,
            "iç_hat_ton": r.iç_hat_ton,
            "dış_hat_ton": r.dış_hat_ton,
        }
        for r in rows
    ]


# --- Admin endpoints for editing statistics ---


@router.get("/admin/air-traffic", response_model=list[dict])
async def admin_list_air_traffic(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return await list_air_traffic(db=db)


@router.patch("/admin/air-traffic/{year}", response_model=dict)
async def admin_update_air_traffic(
    year: int,
    payload: AirTrafficUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    row = db.query(AnnualAirTraffic).filter(AnnualAirTraffic.yil == year).first()
    if not row:
        row = AnnualAirTraffic(
            yil=year,
            tüm_uçak_overflight_dahil=0,
            uçak_trafiği=0,
            iç_hat=0,
            dış_hat=0,
            overflight_uçak_trafiği=0,
        )
        db.add(row)

    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    return {"detail": "Kayıt güncellendi", "yil": year}


@router.get("/admin/cargo-traffic", response_model=list[dict])
async def admin_list_cargo_traffic(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return await list_cargo_traffic(db=db)


@router.patch("/admin/cargo-traffic/{year}", response_model=dict)
async def admin_update_cargo_traffic(
    year: int,
    payload: CargoTrafficUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    row = db.query(AnnualCargoTraffic).filter(AnnualCargoTraffic.yil == year).first()
    if not row:
        row = AnnualCargoTraffic(
            yil=year,
            kargo_trafiği_ton=0,
            iç_hat_kargo_ton=0,
            dış_hat_kargo_ton=0,
        )
        db.add(row)

    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    return {"detail": "Kayıt güncellendi", "yil": year}


@router.get("/admin/passenger-traffic", response_model=list[dict])
async def admin_list_passenger_traffic(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return await list_passenger_traffic(db=db)


@router.patch("/admin/passenger-traffic/{year}", response_model=dict)
async def admin_update_passenger_traffic(
    year: int,
    payload: PassengerTrafficUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    row = (
        db.query(AnnualPassengerTraffic)
        .filter(AnnualPassengerTraffic.yil == year)
        .first()
    )
    if not row:
        row = AnnualPassengerTraffic(
            yil=year,
            yolcu_trafiği_transit_dahil=0,
            yolcu_trafiği=0,
            iç_hat=0,
            dış_hat=0,
            direkt_transit=0,
        )
        db.add(row)

    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    return {"detail": "Kayıt güncellendi", "yil": year}


@router.get("/admin/freight-traffic", response_model=list[dict])
async def admin_list_freight_traffic(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return await list_freight_traffic(db=db)


@router.patch("/admin/freight-traffic/{year}", response_model=dict)
async def admin_update_freight_traffic(
    year: int,
    payload: FreightTrafficUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    row = (
        db.query(AnnualFreightTraffic)
        .filter(AnnualFreightTraffic.yil == year)
        .first()
    )
    if not row:
        row = AnnualFreightTraffic(
            yil=year,
            yük_trafiği_ton=0,
            iç_hat_ton=0,
            dış_hat_ton=0,
        )
        db.add(row)

    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    return {"detail": "Kayıt güncellendi", "yil": year}

