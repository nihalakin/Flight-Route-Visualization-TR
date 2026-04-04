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
    rating: int = Field(..., ge=1, le=5)
    content: str


class CommentResponse(BaseModel):
    id: int
    user_id: int
    ticket_segment_id: int
    rating: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


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
        rating=data.rating,
        content=data.content.strip(),
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


@router.get("/me", response_model=list[CommentResponse])
async def list_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının yaptığı tüm segment yorumlarını listeler."""
    comments = (
        db.query(Comment)
        .filter(Comment.user_id == current_user.id)
        .order_by(Comment.created_at.desc())
        .all()
    )
    return comments
