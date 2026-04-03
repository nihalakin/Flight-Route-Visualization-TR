"""
Bilet detayları: segment dışı genel bilgiler.
Rezervasyon özeti (süre, yolcu sayısı, tutar, PNR, kabin sınıfı, direct/connecting).
Operasyonel uçuş bilgileri ticket_segments tablosundadır.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String

from app.database import Base


# Rota tipi: "direct" | "connecting" (API'de string olarak kullanılır)
ROUTE_TYPE_DIRECT = "direct"
ROUTE_TYPE_CONNECTING = "connecting"


class TicketDetail(Base):
    """Rezervasyona ait segment dışı genel bilgiler."""

    __tablename__ = "ticket_details"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    route_category = Column(String(20), nullable=True, index=True)  # "direct" | "connecting"
    total_duration_minutes = Column(Integer, nullable=True)
    passenger_count = Column(Integer, nullable=True)
    ticket_amount = Column(Float, nullable=True)
    coupon_discount_amount = Column(Float, nullable=True)
    coupon_code = Column(String(50), nullable=True)
    cabin_class = Column(String(50), nullable=True)
    pnr = Column(String(20), nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
