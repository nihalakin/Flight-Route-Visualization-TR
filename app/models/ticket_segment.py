"""
Uçuş bacakları: her segment bir kayıt.
Direkt uçuşta 1, aktarmalıda her bacak için ayrı kayıt.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String

from app.database import Base


class TicketSegment(Base):
    """Rezervasyona ait tek bir uçuş bacağı (segment)."""

    __tablename__ = "ticket_segments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_detail_id = Column(
        Integer,
        ForeignKey("ticket_details.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    segment_order = Column(Integer, nullable=False)  # 1, 2, 3 ...
    airline_id = Column(Integer, ForeignKey("airlines.id"), nullable=True, index=True)
    airline_name = Column(String(120), nullable=True)
    flight_number = Column(String(20), nullable=True)
    departure_city = Column(String(120), nullable=True)
    departure_airport_code = Column(String(10), nullable=True)
    arrival_city = Column(String(120), nullable=True)
    arrival_airport_code = Column(String(10), nullable=True)
    departure_datetime = Column(DateTime, nullable=True)
    arrival_datetime = Column(DateTime, nullable=True)
    segment_duration_minutes = Column(Integer, nullable=True)
    ticket_number = Column(String(30), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
