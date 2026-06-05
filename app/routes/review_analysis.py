"""
Yorum analizi API'si. Analiz sonuçları havayoluna göre ayrılır.
Analiz edilmemiş onaylı yorumlar batch halinde OpenRouter (Gemma 3 27B) ile analiz edilir,
sonuçlar user_review_analysis tablosuna airline_name ile yazılır.
"""
import logging

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import SessionLocal, get_db
from app.repositories.review_analysis_repo import (
    get_aggregated_result_for_airline,
    get_airlines_with_unanalyzed_reviews,
    get_unanalyzed_approved_reviews_for_airline,
    save_analysis_batch,
)
from app.services.review_analysis import ReviewAnalysisError, analyze_reviews

logger = logging.getLogger(__name__)
router = APIRouter(tags=["review-analysis"])

REVIEW_ANALYSIS_BATCH_SIZE = 50


class SentimentDistribution(BaseModel):
    positive: int = 0
    negative: int = 0
    neutral: int = 0


class AnalyzeReviewsResponse(BaseModel):
    airline_name: str
    most_complained_topics: list[str]
    most_liked_aspects: list[str]
    sentiment_distribution: SentimentDistribution
    preference_reasons: list[str]
    avoidance_reasons: list[str]
    customer_recommendations: list[str]
    time_trends: list[dict[str, Any]] = []
    route_satisfaction: list[dict[str, Any]] = []
    rating_analysis: dict[str, Any] = {}
    title_themes: list[str] = []
    frequent_words: list[str] = []


def _aggregated_to_response(aggregated: dict, airline_name: str) -> AnalyzeReviewsResponse:
    sd = aggregated.get("sentiment_distribution") or {}
    return AnalyzeReviewsResponse(
        airline_name=airline_name,
        most_complained_topics=aggregated.get("most_complained_topics") or [],
        most_liked_aspects=aggregated.get("most_liked_aspects") or [],
        sentiment_distribution=SentimentDistribution(
            positive=sd.get("positive", 0),
            negative=sd.get("negative", 0),
            neutral=sd.get("neutral", 0),
        ),
        preference_reasons=aggregated.get("preference_reasons") or [],
        avoidance_reasons=aggregated.get("avoidance_reasons") or [],
        customer_recommendations=aggregated.get("customer_recommendations") or [],
        time_trends=aggregated.get("time_trends") or [],
        route_satisfaction=aggregated.get("route_satisfaction") or [],
        rating_analysis=aggregated.get("rating_analysis") or {},
        title_themes=aggregated.get("title_themes") or [],
        frequent_words=aggregated.get("frequent_words") or [],
    )


@router.get("/analyze-reviews/result", response_model=AnalyzeReviewsResponse)
def get_analysis_result(
    airline: str = Query(..., description="Havayolu adı (örn. Pegasus Airlines, Turkish Airlines)"),
    db=Depends(get_db),
):
    """
    Veritabanındaki user_review_analysis tablosundan sadece belirtilen havayoluna ait
    analiz sonuçlarını (agregasyon) döndürür. Model çağrılmaz.
    """
    aggregated = get_aggregated_result_for_airline(db, airline)
    return _aggregated_to_response(aggregated, airline)


@router.post("/analyze-reviews", response_model=AnalyzeReviewsResponse)
async def post_analyze_reviews(
    airline: str | None = Query(None, description="Havayolu adı; verilmezse analiz edilmemiş yorumu olan ilk havayolu işlenir"),
    db=Depends(get_db),
):
    """
    Belirtilen havayoluna ait analiz edilmemiş onaylı yorumları bir batch halinde OpenRouter'a gönderir,
    sonucu airline_name ile user_review_analysis tablosuna yazar.
    airline verilmezse analiz edilmemiş yorumu olan ilk havayolu seçilir.
    """
    if airline:
        airline_to_process = airline.strip() or None
    else:
        airlines_with_pending = get_airlines_with_unanalyzed_reviews(db)
        if not airlines_with_pending:
            # Hiç analiz edilmemiş yorum yok; mevcut sonuç dönmek için airline gerekli
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Analiz edilecek onaylı yorum yok. Havayolu seçerek sadece o havayolunun sonuçlarını görebilirsiniz.",
            )
        airline_to_process = airlines_with_pending[0]

    unanalyzed = get_unanalyzed_approved_reviews_for_airline(db, airline_to_process)
    if not unanalyzed:
        logger.info("analyze-reviews: %s için analiz edilmemiş yorum yok, mevcut sonuç dönülüyor", airline_to_process)
        aggregated = get_aggregated_result_for_airline(db, airline_to_process)
        return _aggregated_to_response(aggregated, airline_to_process)

    batch = unanalyzed[:REVIEW_ANALYSIS_BATCH_SIZE]
    review_ids = [r[0] for r in batch]
    logger.info("analyze-reviews: %s için %d yorum batch halinde analiz edilecek", airline_to_process, len(batch))

    try:
        result = await analyze_reviews(batch)
    except ReviewAnalysisError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e

    save_analysis_batch(db, review_ids, result, airline_to_process)
    aggregated = get_aggregated_result_for_airline(db, airline_to_process)
    return _aggregated_to_response(aggregated, airline_to_process)


async def run_analysis_for_airline_background(airline_name: str) -> None:
    """
    Arka planda çalışır: Belirtilen havayoluna ait analiz edilmemiş onaylı yorumları
    modele gönderir ve sonucu veritabanına yazar. Admin yorum onayladığında bu fonksiyon
    BackgroundTasks ile çağrılır. Aynı yorum tekrar modele gönderilmez.
    """
    db = SessionLocal()
    try:
        unanalyzed = get_unanalyzed_approved_reviews_for_airline(db, airline_name)
        if not unanalyzed:
            return
        batch = unanalyzed[:REVIEW_ANALYSIS_BATCH_SIZE]
        review_ids = [r[0] for r in batch]
        logger.info("background: %s için %d yorum analiz ediliyor", airline_name, len(batch))
        try:
            result = await analyze_reviews(batch)
            save_analysis_batch(db, review_ids, result, airline_name)
        except ReviewAnalysisError as e:
            logger.warning("background analiz hatası (%s): %s", airline_name, e)
    finally:
        db.close()
