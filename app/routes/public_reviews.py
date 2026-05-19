"""
Public yorum API'si (segment bazlı comments).
Tüm segment yorumları listelenir; rota ve havayolu bilgisi segmentten alınır.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Comment, TicketSegment, TicketDetail
from app.models.comment import COMMENT_STATUS_APPROVED

router = APIRouter(prefix="/public", tags=["public-reviews"])


class PublicReviewCard(BaseModel):
    username: str
    airline_name: str
    route: str
    route_category: Optional[str]
    travel_date: Optional[datetime]
    review_date: datetime
    rating: int
    verified_label: str = "Verified Flight Experience"


@router.get("/reviews", response_model=list[PublicReviewCard])
async def list_public_reviews(
    db: Session = Depends(get_db),
):
    """
    Public yorum listesi: comments tablosundaki tüm yorumlar.
    Rota ve havayolu segmentten (ticket_segments) alınır.
    """
    rows = (
        db.query(Comment, User, TicketSegment, TicketDetail)
        .join(User, User.id == Comment.user_id)
        .join(TicketSegment, TicketSegment.id == Comment.ticket_segment_id)
        .join(TicketDetail, TicketDetail.id == TicketSegment.ticket_detail_id)
        .filter(Comment.status == COMMENT_STATUS_APPROVED)
        .order_by(Comment.created_at.desc())
        .all()
    )

    cards: list[PublicReviewCard] = []
    for c, u, seg, detail in rows:
        username = u.username if u and u.username else None
        if not username and u:
            username = f"{u.first_name} {u.last_name[0]}." if u.last_name else u.first_name

        dep = seg.departure_city or seg.departure_airport_code or ""
        arr = seg.arrival_city or seg.arrival_airport_code or ""
        route_str = f"{dep} – {arr}".strip(" –") if dep or arr else ""
        route_category = detail.route_category if detail else None
        travel_date = seg.departure_datetime

        cards.append(
            PublicReviewCard(
                username=username or "Anonim",
                airline_name=seg.airline_name or "",
                route=route_str,
                route_category=route_category,
                travel_date=travel_date,
                review_date=c.created_at,
                rating=c.rating,
            )
        )
    return cards
