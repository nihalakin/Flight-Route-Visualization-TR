"""
Public yorum API'si.

Kurallar:
- Sadece status = approved ve deleted_at IS NULL olan yorumlar döndürülür.
- Kullanıcı adı, havayolu adı, rota, rota kategorisi, seyahat ve yorum tarihi,
  rating ve 'Verified Flight Experience' etiketi gösterilir.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserReview, TicketDetail, Airline
from app.models.user_review import ReviewStatus

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
    Public yorum listesi:
    - status = approved
    - deleted_at IS NULL
    """
    reviews = (
        db.query(UserReview)
        .filter(
            UserReview.status == ReviewStatus.APPROVED,
            UserReview.deleted_at.is_(None),
        )
        .order_by(UserReview.created_at.desc())
        .all()
    )

    cards: list[PublicReviewCard] = []
    for r in reviews:
        user = db.query(User).filter(User.id == r.user_id).first()
        airline = db.query(Airline).filter(Airline.id == r.airline_id).first()
        detail = (
            db.query(TicketDetail)
            .filter(TicketDetail.ticket_id == r.ticket_id)
            .first()
        )

        username = user.username if user and user.username else None
        if not username and user:
            username = f"{user.first_name} {user.last_name[0]}." if user.last_name else user.first_name

        route_str = ""
        route_category = None
        travel_date: Optional[datetime] = None

        if detail:
            dep = detail.departure_city or detail.departure_airport_code or ""
            arr = detail.arrival_city or detail.arrival_airport_code or ""
            if dep or arr:
                route_str = f"{dep} – {arr}".strip(" –")
            if detail.route_category is not None:
                route_category = detail.route_category.value
            travel_date = detail.departure_datetime

        cards.append(
            PublicReviewCard(
                username=username or "Anonim",
                airline_name=airline.name if airline else "",
                route=route_str,
                route_category=route_category,
                travel_date=travel_date,
                review_date=r.created_at,
                rating=r.rating,
            )
        )

    return cards

