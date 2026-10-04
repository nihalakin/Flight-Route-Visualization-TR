from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class AirlineDatasetReview(Base):
    """
    CSV'den gelen havayolu yorum datası.
    Her satır bir yorum kaydıdır ve is_processed alanı LLM ile analiz edilip edilmediğini tutar.
    """

    __tablename__ = "airline_dataset_reviews"

    id = Column(Integer, primary_key=True, index=True)

    # Kaynağın orijinal satır numarası / ID'si (opsiyonel)
    external_id = Column(Integer, nullable=True, index=True)

    airline_name = Column(String(120), nullable=False, index=True)
    user_name = Column(String(255), nullable=True)
    contribution_count = Column(Integer, nullable=True)
    rating = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    route = Column(String(255), nullable=True)
    category = Column(String(64), nullable=True)
    travel_date_raw = Column(String(64), nullable=True)
    review_date = Column(Date, nullable=True)
    content = Column(Text, nullable=False)
    sentiment_label = Column(String(32), nullable=True)

    # LLM tarafından işlenip işlenmediği
    is_processed = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class AirlineDatasetAnalysis(Base):
    """
    Dataset bazlı analiz batch sonucu (belirli bir havayolu için).
    Yapı, user_review_analysis tablosuna benzerdir.
    """

    __tablename__ = "airline_dataset_analysis"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    airline_name = Column(String(120), nullable=False, default="", index=True)
    reviews_analyzed_count = Column(Integer, nullable=False, default=0)

    most_complained_topics = Column(JSON, nullable=False, default=list)
    most_liked_aspects = Column(JSON, nullable=False, default=list)
    sentiment_positive = Column(Integer, nullable=False, default=0)
    sentiment_negative = Column(Integer, nullable=False, default=0)
    sentiment_neutral = Column(Integer, nullable=False, default=0)
    preference_reasons = Column(JSON, nullable=False, default=list)
    avoidance_reasons = Column(JSON, nullable=False, default=list)
    customer_recommendations = Column(JSON, nullable=False, default=list)
    time_trends = Column(JSON, nullable=False, default=list)
    route_satisfaction = Column(JSON, nullable=False, default=list)
    rating_analysis = Column(JSON, nullable=False, default=dict)
    title_themes = Column(JSON, nullable=False, default=list)
    frequent_words = Column(JSON, nullable=False, default=list)

    review_links = relationship(
        "AirlineDatasetAnalysisReview",
        back_populates="analysis",
        cascade="all, delete-orphan",
    )


class AirlineDatasetAnalysisReview(Base):
    """
    Hangi dataset kaydının hangi batch'te analiz edildiğini tutar.
    Her kayıt yalnızca bir kez analiz edilir.
    """

    __tablename__ = "airline_dataset_analysis_reviews"

    id = Column(Integer, primary_key=True, index=True)

    airline_dataset_analysis_id = Column(
        Integer,
        ForeignKey("airline_dataset_analysis.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dataset_review_id = Column(
        Integer,
        ForeignKey("airline_dataset_reviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    analysis = relationship("AirlineDatasetAnalysis", back_populates="review_links")

    __table_args__ = (
        UniqueConstraint(
            "dataset_review_id", name="uq_airline_dataset_analysis_reviews_dataset_review"
        ),
    )

