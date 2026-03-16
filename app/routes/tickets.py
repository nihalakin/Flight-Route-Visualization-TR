"""
Kullanıcı biletleri: kaydetme, listeleme ve önizleme.
ticket_details tablosuna detay kaydı (raporlama/analiz) da yapılır.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ticket, TicketDetail, User, Airline, UserReview, Coupon
from app.models.user_review import ReviewStatus
from app.services.route_category import calculate_route_category
from app.routes.auth import get_current_user

router = APIRouter(prefix="/tickets", tags=["tickets"])


class TicketDetailCreate(BaseModel):
    """Bilet detayları (ticket_details tablosu)."""
    passenger_first_name: str
    passenger_last_name: str
    passenger_email: str | None = None
    passenger_phone: str | None = None
    pnr: str
    ticket_number: str
    flight_number: str | None = None
    airline_name: str | None = None
    cabin_class: str | None = None
    departure_city: str | None = None
    departure_airport_code: str | None = None
    arrival_city: str | None = None
    arrival_airport_code: str | None = None
    transfer_city: str | None = None
    transfer_airport_code: str | None = None
    total_duration_minutes: int | None = None
    passenger_count: int | None = None
    ticket_amount: float | None = None
    coupon_code: str | None = None
    coupon_discount_amount: float | None = None
    departure_datetime: datetime | None = None
    arrival_datetime: datetime | None = None


class TicketCreate(BaseModel):
    title: str
    html_content: str
    details: TicketDetailCreate | None = None


class TicketResponse(BaseModel):
    id: int
    title: str
    created_at: str
    has_review: bool = False
    review_status: str | None = None
    can_review: bool = False

    class Config:
        from_attributes = True


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TicketResponse)
async def create_ticket(
    data: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bilet oluşturup kullanıcıya kaydeder. İsteğe bağlı details ile ticket_details tablosuna da yazar."""
    try:
        ticket = Ticket(
            user_id=current_user.id,
            title=data.title[:255] if data.title else "Bilet",
            html_content=data.html_content,
        )
        db.add(ticket)
        db.flush()  # ticket.id almak için
        if data.details:
            d = data.details

            # airline_name üzerinden airlines tablosunda case-insensitive arama
            airline_id = None
            if d.airline_name:
                name_normalized = (d.airline_name or "").strip()
                if name_normalized:
                    airline = (
                        db.query(Airline)
                        .filter(func.lower(Airline.name) == name_normalized.lower())
                        .first()
                    )
                    if airline:
                        airline_id = airline.id

            detail = TicketDetail(
                user_id=current_user.id,
                ticket_id=ticket.id,
                passenger_first_name=d.passenger_first_name[:120] if d.passenger_first_name else "",
                passenger_last_name=d.passenger_last_name[:120] if d.passenger_last_name else "",
                passenger_email=d.passenger_email[:255] if d.passenger_email else None,
                passenger_phone=d.passenger_phone[:50] if d.passenger_phone else None,
                pnr=d.pnr[:20] if d.pnr else "",
                ticket_number=d.ticket_number[:30] if d.ticket_number else "",
                flight_number=d.flight_number[:20] if d.flight_number else None,
                airline_name=d.airline_name[:120] if d.airline_name else None,
                cabin_class=d.cabin_class[:50] if d.cabin_class else None,
                airline_id=airline_id,
                departure_city=d.departure_city[:120] if d.departure_city else None,
                departure_airport_code=d.departure_airport_code[:10] if d.departure_airport_code else None,
                arrival_city=d.arrival_city[:120] if d.arrival_city else None,
                arrival_airport_code=d.arrival_airport_code[:10] if d.arrival_airport_code else None,
                transfer_city=d.transfer_city[:120] if d.transfer_city else None,
                transfer_airport_code=d.transfer_airport_code[:10] if d.transfer_airport_code else None,
                total_duration_minutes=d.total_duration_minutes,
                passenger_count=d.passenger_count,
                ticket_amount=d.ticket_amount,
                coupon_code=d.coupon_code[:50] if d.coupon_code else None,
                coupon_discount_amount=d.coupon_discount_amount,
                departure_datetime=d.departure_datetime,
                arrival_datetime=d.arrival_datetime,
            )
            # Rota kategorisini backend tarafında otomatik hesapla
            detail.route_category = calculate_route_category(
                detail.departure_airport_code,
                detail.arrival_airport_code,
            )
            db.add(detail)

            # Eğer kupon kodu gönderildiyse, veritabanındaki kuponu işaretle
            if d.coupon_code:
                code = (d.coupon_code or "").strip().upper()
                if code:
                    coupon = (
                        db.query(Coupon)
                        .filter(
                            Coupon.code == code,
                            Coupon.deleted_at.is_(None),
                        )
                        .first()
                    )
                    if coupon:
                        max_uses = getattr(coupon, "max_uses", 1)
                        use_count = getattr(coupon, "use_count", 0)
                        if coupon.is_used or use_count >= max_uses:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Kupon kullanım limiti dolmuştur." if use_count >= max_uses else "Bu kupon kodu daha önce kullanılmış.",
                            )
                        today = datetime.utcnow().date()
                        if not coupon.is_active or coupon.expiry_date < today:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Kupon kodu aktif değil veya süresi dolmuş.",
                            )
                        coupon.use_count = use_count + 1
                        coupon.used_at = datetime.utcnow()
                        coupon.used_by_user_id = current_user.id
                        if coupon.use_count >= max_uses:
                            coupon.is_used = True
                        # Kupon tutarı TicketDetail üzerinde kayıtlı değilse, veritabanından set et
                        if detail.coupon_discount_amount is None and coupon.refund_amount is not None:
                            detail.coupon_discount_amount = coupon.refund_amount
        db.commit()
        db.refresh(ticket)
        return TicketResponse(
            id=ticket.id,
            title=ticket.title,
            created_at=ticket.created_at.isoformat() if ticket.created_at else "",
        )
    except Exception as e:
        db.rollback()
        # Daha anlaşılır hata mesajı döndür (500 yerine detaylı)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ticket create failed: {e}",
        )


@router.get("", response_model=list[TicketResponse])
async def list_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının tüm biletlerini listeler ve yorum/uygunluk bilgisini döner."""
    tickets = (
        db.query(Ticket)
        .filter(Ticket.user_id == current_user.id)
        .order_by(Ticket.created_at.desc())
        .all()
    )
    if not tickets:
        return []

    ticket_ids = [t.id for t in tickets]

    # İlgili ticket_details kayıtlarını al
    details = (
        db.query(TicketDetail)
        .filter(TicketDetail.ticket_id.in_(ticket_ids), TicketDetail.user_id == current_user.id)
        .all()
    )
    details_by_ticket: dict[int, TicketDetail] = {d.ticket_id: d for d in details if d.ticket_id is not None}

    # İlgili user_reviews kayıtlarını al
    reviews = (
        db.query(UserReview)
        .filter(UserReview.ticket_id.in_(ticket_ids), UserReview.deleted_at.is_(None))
        .all()
    )
    reviews_by_ticket: dict[int, UserReview] = {r.ticket_id: r for r in reviews}

    now = datetime.utcnow()
    responses: list[TicketResponse] = []

    for t in tickets:
        detail = details_by_ticket.get(t.id)
        review = reviews_by_ticket.get(t.id)

        has_review = review is not None
        review_status = review.status.value if review else None

        # Uçuş tamamlanmış mı? (departure_datetime veya arrival_datetime now'dan küçükse)
        flight_completed = False
        if detail:
            dep = detail.departure_datetime
            arr = detail.arrival_datetime
            if dep and dep < now:
                flight_completed = True
            elif arr and arr < now:
                flight_completed = True

        can_review = (not has_review) and flight_completed

        responses.append(
            TicketResponse(
                id=t.id,
                title=t.title,
                created_at=t.created_at.isoformat() if t.created_at else "",
                has_review=has_review,
                review_status=review_status,
                can_review=can_review,
            )
        )

    return responses


@router.get("/{ticket_id}/preview", response_class=HTMLResponse)
async def preview_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bilet önizlemesi (sadece bilet sahibi erişebilir). Yeni sekmede açılır."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilet bulunamadı")
    return HTMLResponse(content=ticket.html_content)
