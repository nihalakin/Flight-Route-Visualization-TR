"""
Segment bazlı yorumlar.
Her uçuş segmenti için ayrı yorum (Comment) yapılabilir.
"""
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Text

from app.database import Base


class Comment(Base):
    """Bir ticket_segment için kullanıcı yorumu (puan + metin)."""

    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_segment_id = Column(
        Integer,
        ForeignKey("ticket_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    rating = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="chk_comments_rating_1_5"),
    )
