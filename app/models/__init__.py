from app.models.user import User
from app.models.ticket import Ticket
from app.models.ticket_detail import TicketDetail
from app.models.ticket_segment import TicketSegment
from app.models.comment import Comment
from app.models.airline import Airline
from app.models.coupon import Coupon
from app.models.airport import Airport
from app.models.password_reset import PasswordReset
from app.models.annual_statistics import (
    AnnualAirTraffic,
    AnnualCargoTraffic,
    AnnualPassengerTraffic,
    AnnualFreightTraffic,
)

__all__ = [
    "User",
    "Ticket",
    "TicketDetail",
    "TicketSegment",
    "Comment",
    "Airline",
    "Coupon",
    "Airport",
    "PasswordReset",
    "AnnualAirTraffic",
    "AnnualCargoTraffic",
    "AnnualPassengerTraffic",
    "AnnualFreightTraffic",
]
