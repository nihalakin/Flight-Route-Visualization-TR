"""
Public yorum API'si (segment bazlı comments).
Sadece admin panelinden onaylanan (status=approved) yorumlar listelenir.
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
    title: Optional[str] = None
    content: str = ""
    verified_label: str = "Doğrulanmış Uçuş Deneyimi"


class AirlineGroup(BaseModel):
    airline_name: str
    reviews: list[PublicReviewCard]


class ReviewsByAirlineResponse(BaseModel):
    by_airline: list[AirlineGroup]


def _build_review_card(c, u, seg, detail) -> PublicReviewCard:
    username = u.username if u and u.username else None
    if not username and u:
        username = f"{u.first_name} {u.last_name[0]}." if u.last_name else (u.first_name or "Anonim")
    dep = seg.departure_city or seg.departure_airport_code or ""
    arr = seg.arrival_city or seg.arrival_airport_code or ""
    route_str = f"{dep} – {arr}".strip(" –") if dep or arr else ""
    route_category = detail.route_category if detail else None
    travel_date = seg.departure_datetime
    return PublicReviewCard(
        username=username or "Anonim",
        airline_name=seg.airline_name or "",
        route=route_str,
        route_category=route_category,
        travel_date=travel_date,
        review_date=c.created_at,
        rating=c.rating,
        title=c.title,
        content=c.content or "",
    )


@router.get("/reviews", response_model=list[PublicReviewCard])
async def list_public_reviews(
    db: Session = Depends(get_db),
):
    """
    Onaylı tüm yorumlar (admin onayından geçen). Havayolu bilgisi segmentten alınır.
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
    return [_build_review_card(c, u, seg, detail) for c, u, seg, detail in rows]


@router.get("/reviews/by-airline", response_model=ReviewsByAirlineResponse)
async def list_public_reviews_by_airline(
    db: Session = Depends(get_db),
):
    """
    Onaylı yorumları havayoluna göre gruplar. Her havayolu için ayrı liste (Pegasus, AJet vb.).
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

    groups: dict[str, list[PublicReviewCard]] = {}
    for c, u, seg, detail in rows:
        card = _build_review_card(c, u, seg, detail)
        name = (seg.airline_name or "").strip() or "Diğer"
        if name not in groups:
            groups[name] = []
        groups[name].append(card)

    by_airline = [
        AirlineGroup(airline_name=name, reviews=reviews)
        for name, reviews in sorted(groups.items(), key=lambda x: x[0].lower())
    ]
    return ReviewsByAirlineResponse(by_airline=by_airline)
