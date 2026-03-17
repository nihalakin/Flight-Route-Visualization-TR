"""
Bilet detayları: raporlama ve analiz için tüm alanlar.
tickets tablosundan ayrı; her bilet kaydı için bir ticket_details satırı.
"""
from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text

from app.database import Base


class RouteCategory(str, Enum):
    """Uçuşun rota tipine göre kategorisi (hizmet kalitesi değil)."""

    DOMESTIC = "DOMESTIC"
    EUROPE = "EUROPE"
    MIDDLE_EAST = "MIDDLE_EAST"
    INTERNATIONAL = "INTERNATIONAL"
    INTERCONTINENTAL = "INTERCONTINENTAL"


class TicketDetail(Base):
    """Bilet oluşturma sürecindeki tüm detaylar (raporlama/analiz)."""
    __tablename__ = "ticket_details"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=True, index=True)

    # Yolcu
    passenger_first_name = Column(String(120), nullable=False)
    passenger_last_name = Column(String(120), nullable=False)
    passenger_email = Column(String(255), nullable=True)
    passenger_phone = Column(String(50), nullable=True)

    # Rezervasyon / bilet
    pnr = Column(String(20), nullable=False, index=True)
    ticket_number = Column(String(30), nullable=False)

    # Uçuş
    flight_number = Column(String(20), nullable=True)
    airline_name = Column(String(120), nullable=True)
    cabin_class = Column(String(50), nullable=True)  # Economy, Business vb.
    airline_id = Column(Integer, ForeignKey("airlines.id"), nullable=True, index=True)

    # Kalkış / varış şehir / kod
    departure_city = Column(String(120), nullable=True)
    departure_airport_code = Column(String(10), nullable=True)
    arrival_city = Column(String(120), nullable=True)
    arrival_airport_code = Column(String(10), nullable=True)

    # Kalkış / varış tarih-saat (tam datetime; uçuş takibi ve doğrulama için)
    departure_datetime = Column(DateTime, nullable=True)
    arrival_datetime = Column(DateTime, nullable=True)

    # Rota kategorisi (hizmet değil, rota tipine göre)
    route_category = Column(
        SAEnum(RouteCategory, name="route_category"),
        nullable=True,
        index=True,
    )

    # Aktarma (opsiyonel)
    transfer_city = Column(String(120), nullable=True)
    transfer_airport_code = Column(String(10), nullable=True)

    # Süre ve yolcu
    total_duration_minutes = Column(Integer, nullable=True)  # dakika
    passenger_count = Column(Integer, nullable=True)

    # Ücret
    ticket_amount = Column(Float, nullable=True)
    coupon_code = Column(String(50), nullable=True)
    coupon_discount_amount = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
