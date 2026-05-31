"""
Segment bazlı yorumlar.
Her uçuş segmenti için ayrı yorum (Comment) yapılabilir.
"""
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base

# Onay durumu: pending, approved, rejected
COMMENT_STATUS_PENDING = "pending"
COMMENT_STATUS_APPROVED = "approved"
COMMENT_STATUS_REJECTED = "rejected"


class Comment(Base):
    """Bir ticket_segment için kullanıcı yorumu (başlık, puan, metin, durum)."""

    __tablename__ = "user_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_segment_id = Column(
        Integer,
        ForeignKey("ticket_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(255), nullable=True)
    rating = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default=COMMENT_STATUS_PENDING, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="chk_user_reviews_rating_1_5"),
    )
