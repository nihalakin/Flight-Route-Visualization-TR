"""
Kullanıcı uçuş yorumları (user_reviews):
- Sadece kendi biletleri için,
- Her bilet için en fazla 1 yorum,
- Uçuş tamamlandıysa (departure_datetime < now),
- Yorumlar başlangıçta status=pending olarak kaydedilir.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ticket, TicketDetail, User, UserReview, Airline
from app.models.user_review import ReviewStatus
from app.routes.auth import get_current_user

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    ticket_id: int
    rating: int = Field(..., ge=1, le=5)
    title: str = Field(..., max_length=255)
    content: str


class ReviewResponse(BaseModel):
    id: int
    ticket_id: int
    rating: int
    title: str
    content: str
    status: ReviewStatus
    created_at: datetime

    class Config:
        from_attributes = True


# Basit process-içi rate limiting (örn. kullanıcı başına dakikada 3 yorum).
_RATE_LIMIT_WINDOW_SECONDS = 60
_RATE_LIMIT_MAX_REVIEWS = 3
_review_events_by_user: dict[int, list[float]] = {}


def _check_rate_limit(user_id: int) -> None:
    import time

    now = time.time()
    window_start = now - _RATE_LIMIT_WINDOW_SECONDS
    events = _review_events_by_user.get(user_id, [])
    # Eski olayları temizle
    events = [ts for ts in events if ts >= window_start]
    if len(events) >= _RATE_LIMIT_MAX_REVIEWS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok sık yorum denemesi yapıyorsunuz. Lütfen biraz sonra tekrar deneyin.",
        )
    events.append(now)
    _review_events_by_user[user_id] = events


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının kendi biletine yorum oluşturması."""
    _check_rate_limit(current_user.id)

    # 1) Ticket mevcut mu ve bu kullanıcıya mı ait?
    ticket: Optional[Ticket] = (
        db.query(Ticket)
        .filter(Ticket.id == data.ticket_id, Ticket.user_id == current_user.id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilet bulunamadı")

    # 2) TicketDetail var mı?
    detail: Optional[TicketDetail] = (
        db.query(TicketDetail)
        .filter(TicketDetail.ticket_id == ticket.id, TicketDetail.user_id == current_user.id)
        .first()
    )
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu bilet için detay kaydı bulunamadı",
        )

    # 3) Uçuş tamamlanmış mı?
    # Öncelik departure_datetime < now; yoksa arrival_datetime < now ile de tamamlanmış sayılır.
    now = datetime.utcnow()
    dep = detail.departure_datetime
    arr = detail.arrival_datetime
    flight_completed = False
    if dep and dep < now:
        flight_completed = True
    elif arr and arr < now:
        flight_completed = True

    if not flight_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uçuş tamamlanmadan yorum yapılamaz",
        )

    # 4) Daha önce yorum yapılmış mı? (UNIQUE(ticket_id) ile de korunuyor)
    existing = db.query(UserReview).filter(UserReview.ticket_id == ticket.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu bilet için zaten bir yorum mevcut",
        )

    # 5) airline_id zorunlu
    if not detail.airline_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu bilet için havayolu bilgisi bulunamadı",
        )

    # Havayolunun varlığını da doğrula (FK integrity için)
    airline = db.query(Airline).filter(Airline.id == detail.airline_id).first()
    if not airline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz havayolu kaydı",
        )

    review = UserReview(
        user_id=current_user.id,
        airline_id=detail.airline_id,
        ticket_id=ticket.id,
        rating=data.rating,
        title=data.title.strip(),
        content=data.content.strip(),
        status=ReviewStatus.PENDING,
    )

    try:
        db.add(review)
        db.commit()
        db.refresh(review)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Yorum oluşturulamadı: {e}",
        )

    return review


@router.get("/me", response_model=list[ReviewResponse])
async def list_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının yaptığı tüm yorumları listeler."""
    reviews = (
        db.query(UserReview)
        .filter(
            UserReview.user_id == current_user.id,
            UserReview.deleted_at.is_(None),
        )
        .order_by(UserReview.created_at.desc())
        .all()
    )
    return reviews

