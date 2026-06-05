"""
Segment bazlı yorumlar (comments tablosu).
Her uçuş segmenti için en fazla bir yorum; uçuş tamamlandıktan sonra yazılabilir.
"""
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ticket, TicketDetail, TicketSegment, Comment, User
from app.models.comment import COMMENT_STATUS_PENDING
from app.routes.auth import get_current_user

router = APIRouter(prefix="/reviews", tags=["reviews"])

_RATE_LIMIT_WINDOW_SECONDS = 60
_RATE_LIMIT_MAX_REVIEWS = 3
_review_events_by_user: dict[int, list[float]] = {}


def _check_rate_limit(user_id: int) -> None:
    now = time.time()
    window_start = now - _RATE_LIMIT_WINDOW_SECONDS
    events = _review_events_by_user.get(user_id, [])
    events = [ts for ts in events if ts >= window_start]
    if len(events) >= _RATE_LIMIT_MAX_REVIEWS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok sık yorum denemesi yapıyorsunuz. Lütfen biraz sonra tekrar deneyin.",
        )
    events.append(now)
    _review_events_by_user[user_id] = events


class CommentCreate(BaseModel):
    ticket_segment_id: int
    title: str | None = None
    rating: int = Field(..., ge=1, le=5)
    content: str


class CommentResponse(BaseModel):
    id: int
    user_id: int
    ticket_segment_id: int
    title: str | None
    rating: int
    content: str
    status: str
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class MyReviewResponse(BaseModel):
    """Yorum + hangi uçuş için yapıldığı (rota, tarih, PNR)."""
    id: int
    user_id: int
    ticket_segment_id: int
    title: str | None
    rating: int
    content: str
    status: str
    created_at: datetime
    updated_at: datetime | None
    flight_label: str  # Örn: "Hakkari (YKO) → Gaziantep (GZT) | 05.03.2026 | PNR PWNL36"


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Segment için yorum oluşturur. Her segment için en fazla bir yorum."""
    _check_rate_limit(current_user.id)

    segment: Optional[TicketSegment] = (
        db.query(TicketSegment).filter(TicketSegment.id == data.ticket_segment_id).first()
    )
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment bulunamadı")

    detail = (
        db.query(TicketDetail)
        .filter(
            TicketDetail.id == segment.ticket_detail_id,
            TicketDetail.user_id == current_user.id,
        )
        .first()
    )
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu segment size ait değil",
        )

    # Bilet iptal edildiyse bu segmente yorum yapılamaz
    if detail.coupon_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="İptal edilen biletler için yorum yapılamaz.",
        )

    ticket = db.query(Ticket).filter(Ticket.id == detail.ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bilet bulunamadı")

    now = datetime.utcnow()
    dep = segment.departure_datetime
    arr = segment.arrival_datetime
    flight_done = (dep and dep < now) or (arr and arr < now)
    if not flight_done:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu segment için uçuş tamamlanmadan yorum yapılamaz",
        )

    existing = (
        db.query(Comment)
        .filter(
            Comment.ticket_segment_id == data.ticket_segment_id,
            Comment.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu segment için zaten yorum yaptınız",
        )

    comment = Comment(
        user_id=current_user.id,
        ticket_segment_id=data.ticket_segment_id,
        title=(data.title or "").strip() or None,
        rating=data.rating,
        content=data.content.strip(),
        status=COMMENT_STATUS_PENDING,
    )
    try:
        db.add(comment)
        db.commit()
        db.refresh(comment)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Yorum oluşturulamadı: {e}",
        )
    return comment


def _flight_label(seg: TicketSegment, pnr: str) -> str:
    """Rota + tarih + PNR: 'Hakkari (YKO) → Gaziantep (GZT) | 05.03.2026 | PNR PWNL36'."""
    dep_city = (seg.departure_city or "").strip()
    dep_code = (seg.departure_airport_code or "").strip()
    arr_city = (seg.arrival_city or "").strip()
    arr_code = (seg.arrival_airport_code or "").strip()
    dep = (dep_city + (" (" + dep_code + ")" if dep_code else "")) if dep_city else (dep_code or "")
    arr = (arr_city + (" (" + arr_code + ")" if arr_code else "")) if arr_city else (arr_code or "")
    route = f"{dep} → {arr}" if (dep or arr) else "Uçuş"
    dt = seg.departure_datetime
    date_str = dt.strftime("%d.%m.%Y") if dt else ""
    pnr_val = (pnr or "").strip() or "N/A"
    parts = [route]
    if date_str:
        parts.append(date_str)
    parts.append("PNR " + pnr_val)
    return " | ".join(parts)


@router.get("/me", response_model=list[MyReviewResponse])
async def list_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının yaptığı tüm segment yorumlarını listeler. Her yorumda hangi uçuş için yapıldığı (flight_label) döner."""
    rows = (
        db.query(Comment, TicketSegment, TicketDetail)
        .join(TicketSegment, TicketSegment.id == Comment.ticket_segment_id)
        .join(TicketDetail, TicketDetail.id == TicketSegment.ticket_detail_id)
        .filter(Comment.user_id == current_user.id)
        .order_by(Comment.created_at.desc())
        .all()
    )
    out: list[MyReviewResponse] = []
    for c, seg, detail in rows:
        flight_label = _flight_label(seg, detail.pnr if detail else "")
        out.append(
            MyReviewResponse(
                id=c.id,
                user_id=c.user_id,
                ticket_segment_id=c.ticket_segment_id,
                title=c.title,
                rating=c.rating,
                content=c.content,
                status=c.status or COMMENT_STATUS_PENDING,
                created_at=c.created_at,
                updated_at=c.updated_at,
                flight_label=flight_label,
            )
        )
    return out
