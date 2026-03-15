"""
Kupon doğrulama API'si.

Amaç:
- Kupon kodlarını veritabanı (coupons tablosu) üzerinden doğrulamak,
- Aktiflik, son kullanım tarihi ve daha önce kullanılıp kullanılmadığına göre geçerlilik döndürmek.
"""

from datetime import datetime, date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Coupon


router = APIRouter(prefix="/coupons", tags=["coupons"])


class CouponValidateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    departure_date: str | None = Field(
        default=None,
        description="Uçuş kalkış tarihi (YYYY-MM-DD). Verilirse kupon son kullanma tarihi bu tarihten sonra olmalıdır.",
    )


class CouponPublic(BaseModel):
    code: str
    airline_name: str | None = None
    discount_amount: float | None = None
    original_amount: float | None = None
    expiry_date: date

    class Config:
        from_attributes = True


class CouponValidateResponse(BaseModel):
    valid: bool
    message: str
    coupon: CouponPublic | None = None


@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon(
    payload: CouponValidateRequest,
    db: Session = Depends(get_db),
) -> CouponValidateResponse:
    """Kupon kodunu veritabanı üzerinden doğrular."""
    code = (payload.code or "").strip().upper()
    if not code:
        return CouponValidateResponse(valid=False, message="Kupon kodu boş olamaz.", coupon=None)

    coupon: Coupon | None = (
        db.query(Coupon)
        .filter(
            Coupon.code == code,
            Coupon.deleted_at.is_(None),
        )
        .first()
    )

    if not coupon:
        return CouponValidateResponse(valid=False, message="Girdiğiniz kupon kodu geçersizdir.", coupon=None)

    today = datetime.utcnow().date()

    if not coupon.is_active:
        return CouponValidateResponse(valid=False, message="Kupon kodu pasif durumdadır.", coupon=None)

    max_uses = getattr(coupon, "max_uses", 1)
    use_count = getattr(coupon, "use_count", 0)
    if coupon.is_used or use_count >= max_uses:
        return CouponValidateResponse(
            valid=False,
            message="Kupon kullanım limiti dolmuştur." if use_count >= max_uses else "Kupon kodu daha önce kullanılmıştır.",
            coupon=None,
        )

    if coupon.expiry_date < today:
        return CouponValidateResponse(valid=False, message="Kupon kodunuzun süresi dolmuştur.", coupon=None)

    if payload.departure_date:
        try:
            dep_date = datetime.strptime(payload.departure_date, "%Y-%m-%d").date()
            if coupon.expiry_date < dep_date:
                return CouponValidateResponse(
                    valid=False,
                    message="Kupon kodunuzun süresi seçilen uçuş tarihinden önce dolmuştur.",
                    coupon=None,
                )
        except ValueError:
            # Geçersiz tarih formatı verilirse sadece logik ignore edilir, temel validasyon yeterli.
            pass

    public = CouponPublic(
        code=coupon.code,
        airline_name=coupon.airline_name,
        discount_amount=coupon.refund_amount,
        original_amount=coupon.original_amount,
        expiry_date=coupon.expiry_date,
    )

    return CouponValidateResponse(
        valid=True,
        message="Kupon geçerli.",
        coupon=public,
    )

