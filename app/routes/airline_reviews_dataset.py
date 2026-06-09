import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import get_db
from app.repositories.airline_reviews_dataset_repo import (
    DEFAULT_AGGREGATED,
    get_aggregated_result_for_airline,
    get_aggregated_result_for_all_airlines,
    get_airlines_with_analysis,
    get_airlines_with_unprocessed_reviews,
    get_multi_airline_overview,
    get_unprocessed_reviews_for_airline,
    save_dataset_analysis_batch,
)
from app.repositories.airline_reviews_dataset_public import (
    get_dataset_reviews_grouped_by_airline,
)
from app.services.review_analysis import ReviewAnalysisError, analyze_reviews

logger = logging.getLogger(__name__)
router = APIRouter(tags=["airline-reviews-dataset"])

# Her istekte yalnızca 1 yeni yorum analiz edilsin (tam sıralı işleme)
DATASET_BATCH_SIZE = 1


class SentimentDistribution(BaseModel):
    positive: int = 0
    negative: int = 0
    neutral: int = 0


class AnalyzeDatasetResponse(BaseModel):
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


def _aggregated_to_response(aggregated: dict[str, Any], airline_name: str) -> AnalyzeDatasetResponse:
    if not aggregated:
        aggregated = dict(DEFAULT_AGGREGATED)
    sd = aggregated.get("sentiment_distribution") or {}
    return AnalyzeDatasetResponse(
        airline_name=airline_name,
        most_complained_topics=aggregated.get("most_complained_topics") or [],
        most_liked_aspects=aggregated.get("most_liked_aspects") or [],
        sentiment_distribution=SentimentDistribution(
            positive=int(sd.get("positive", 0) or 0),
            negative=int(sd.get("negative", 0) or 0),
            neutral=int(sd.get("neutral", 0) or 0),
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


@router.get(
    "/airline-reviews-dataset/airlines",
    response_model=list[str],
)
def get_dataset_airlines(db=Depends(get_db)):
    """
    Dataset'te analiz sonucu olan veya analiz bekleyen havayollarının listesi.
    """
    have_analysis = set(get_airlines_with_analysis(db))
    have_pending = set(get_airlines_with_unprocessed_reviews(db))
    out = sorted(have_analysis | have_pending)
    return out


@router.get(
    "/airline-reviews-dataset/result",
    response_model=AnalyzeDatasetResponse,
)
def get_dataset_analysis_result(
    airline: str | None = Query(
        None,
        description="Dataset için havayolu adı (örn. Pegasus). Boş bırakılırsa tüm havayolları için global analiz döner.",
    ),
    db=Depends(get_db),
):
    """
    Dataset analiz tablosundan agregasyon döndürür.
    - airline verilirse: sadece belirtilen havayoluna ait sonuçlar
    - airline boş bırakılırsa: tüm havayollarına ait global sonuç
    Model çağrısı yapılmaz.
    """
    if not airline:
        aggregated = get_aggregated_result_for_all_airlines(db)
        return _aggregated_to_response(aggregated, "Tüm Havayolları")
    aggregated = get_aggregated_result_for_airline(db, airline)
    return _aggregated_to_response(aggregated, airline)


@router.get(
    "/airline-reviews-dataset/overview",
    response_model=list[dict[str, Any]],
)
def get_dataset_multi_airline_overview(db=Depends(get_db)):
    """
    Çoklu havayolu karşılaştırma kartları ve hacim trendi için
    havayolu bazında özet (sentiment dağılımı + zaman trendi).
    """
    return get_multi_airline_overview(db)


@router.get(
    "/airline-reviews-dataset/reviews-by-airline",
)
def get_dataset_reviews_by_airline(db=Depends(get_db)):
    """
    Dataset içindeki ham yorumları havayoluna göre gruplanmış biçimde döndürür.
    {
      "by_airline": [
        {
          "airline_name": "Pegasus",
          "reviews": [{ route, review_date, title, content, rating, username, user_total_reviews }, ...]
        },
        ...
      ]
    }
    """
    return get_dataset_reviews_grouped_by_airline(db)


@router.post(
    "/airline-reviews-dataset/analyze",
    response_model=AnalyzeDatasetResponse,
)
async def post_dataset_analyze(
    airline: str | None = Query(
        None,
        description="Havayolu adı; verilmezse işlenmemiş kaydı olan ilk havayolu seçilir",
    ),
    db=Depends(get_db),
):
    """
    Dataset tablosunda henüz is_processed = False olan kayıtları batch halinde modele gönderir,
    sonuçları airline_dataset_analysis tablosuna kaydeder ve işlenen kayıtları is_processed=True yapar.
    Aynı kayıt tekrar modele gitmez.
    """
    if airline:
        airline_to_process = airline.strip() or None
    else:
        airlines_with_pending = get_airlines_with_unprocessed_reviews(db)
        if not airlines_with_pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Analiz edilecek dataset kaydı bulunamadı.",
            )
        airline_to_process = airlines_with_pending[0]

    if not airline_to_process:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçerli bir havayolu adı gerekli.",
        )

    unanalyzed = get_unprocessed_reviews_for_airline(db, airline_to_process)
    if not unanalyzed:
        logger.info(
            "dataset-analyze: %s için analiz edilmemiş kayıt yok, mevcut sonuç döndürülüyor",
            airline_to_process,
        )
        aggregated = get_aggregated_result_for_airline(db, airline_to_process)
        return _aggregated_to_response(aggregated, airline_to_process)

    batch = unanalyzed[:DATASET_BATCH_SIZE]
    review_ids = [r[0] for r in batch]
    logger.info(
        "dataset-analyze: %s için %d kayıt batch halinde analiz edilecek",
        airline_to_process,
        len(batch),
    )

    try:
        result = await analyze_reviews(batch)
    except ReviewAnalysisError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e

    save_dataset_analysis_batch(db, review_ids, result, airline_to_process)
    aggregated = get_aggregated_result_for_airline(db, airline_to_process)
    return _aggregated_to_response(aggregated, airline_to_process)

