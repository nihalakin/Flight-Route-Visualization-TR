"""
Yorum analiz sonuçları: Her batch çalıştırmasının sonucu ve hangi yorumların analiz edildiği.
Her yorum en fazla bir kez analiz edilir (user_review_analysis_reviews ile takip).
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class UserReviewAnalysis(Base):
    """
    Bir batch analiz sonucu (belirli bir havayolu için). OpenRouter'dan dönen yanıt
    airline_name ile birlikte bu tabloya yazılır; dashboard havayoluna göre ayrı hesaplanır.
    """
    __tablename__ = "user_review_analysis"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    airline_name = Column(String(120), nullable=False, default="", index=True)
    reviews_analyzed_count = Column(Integer, nullable=False, default=0)

    most_complained_topics = Column(JSON, nullable=False, default=list)  # list[str]
    most_liked_aspects = Column(JSON, nullable=False, default=list)
    sentiment_positive = Column(Integer, nullable=False, default=0)
    sentiment_negative = Column(Integer, nullable=False, default=0)
    sentiment_neutral = Column(Integer, nullable=False, default=0)
    preference_reasons = Column(JSON, nullable=False, default=list)
    avoidance_reasons = Column(JSON, nullable=False, default=list)
    customer_recommendations = Column(JSON, nullable=False, default=list)
    time_trends = Column(JSON, nullable=False, default=list)  # [{ period, positive?, negative?, neutral?, review_count? }]
    route_satisfaction = Column(JSON, nullable=False, default=list)  # [{ route, sentiment, complaints[], liked[] }]
    rating_analysis = Column(JSON, nullable=False, default=dict)  # { average_rating, std_dev, review_count }
    title_themes = Column(JSON, nullable=False, default=list)
    frequent_words = Column(JSON, nullable=False, default=list)

    review_links = relationship("UserReviewAnalysisReview", back_populates="analysis", cascade="all, delete-orphan")


class UserReviewAnalysisReview(Base):
    """
    Hangi yorumun hangi batch'te analiz edildiği. Bir yorum sadece bir kez yer alır.
    """
    __tablename__ = "user_review_analysis_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_review_analysis_id = Column(
        Integer,
        ForeignKey("user_review_analysis.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_review_id = Column(
        Integer,
        ForeignKey("user_reviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    analysis = relationship("UserReviewAnalysis", back_populates="review_links")

    __table_args__ = (UniqueConstraint("user_review_id", name="uq_user_review_analysis_reviews_review"),)
