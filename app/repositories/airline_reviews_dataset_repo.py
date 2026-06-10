from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    AirlineDatasetAnalysis,
    AirlineDatasetAnalysisReview,
    AirlineDatasetReview,
)

# (id, content, title, rating, created_at, route)
ReviewItem = tuple[int, str, str | None, int, Any, str]

DEFAULT_AGGREGATED = {
    "most_complained_topics": [],
    "most_liked_aspects": [],
    "sentiment_distribution": {"positive": 0, "negative": 0, "neutral": 0},
    "preference_reasons": [],
    "avoidance_reasons": [],
    "customer_recommendations": [],
    "time_trends": [],
    "route_satisfaction": [],
    "rating_analysis": {},
    "title_themes": [],
    "frequent_words": [],
}


def _normalize_airline_name(name: str | None) -> str:
    if not name or not str(name).strip():
        return "Diğer"
    return str(name).strip()


def get_unprocessed_reviews_for_airline(db: Session, airline_name: str) -> list[ReviewItem]:
    """
    Belirtilen havayoluna ait, henüz is_processed = False olan dataset kayıtlarını döndürür.
    Returns: [(id, content, title, rating, created_at, route), ...]
    """
    normalized = _normalize_airline_name(airline_name)
    q = db.query(AirlineDatasetReview).filter(AirlineDatasetReview.is_processed.is_(False))
    if normalized == "Diğer":
        q = q.filter(
            (AirlineDatasetReview.airline_name.is_(None))
            | (AirlineDatasetReview.airline_name == "")
        )
    else:
        q = q.filter(AirlineDatasetReview.airline_name == normalized)

    rows = q.order_by(AirlineDatasetReview.review_date.asc().nulls_last()).all()
    out: list[ReviewItem] = []
    for r in rows:
        content = (r.content or "").strip()
        if not content:
            continue
        route = (r.route or "").strip() or "Bilinmiyor"
        created = r.review_date or r.created_at
        rating = int(r.rating or 0)
        rating = max(1, min(5, rating))
        title = (r.title or "").strip() or None
        out.append((r.id, content, title, rating, created, route))
    return out


def get_airlines_with_unprocessed_reviews(db: Session) -> list[str]:
    """Analiz edilmemiş dataset kaydı olan havayolu adlarını döndürür."""
    rows = (
        db.query(AirlineDatasetReview.airline_name)
        .filter(AirlineDatasetReview.is_processed.is_(False))
        .distinct()
        .all()
    )
    return sorted({_normalize_airline_name(r[0]) for r in rows})


def save_dataset_analysis_batch(
    db: Session,
    review_ids: list[int],
    result: dict[str, Any],
    airline_name: str,
) -> AirlineDatasetAnalysis:
    """
    Bir batch dataset analiz sonucunu belirtilen havayolu adıyla kaydeder
    ve ilgili kayıtları is_processed = True yapar.
    """
    normalized = _normalize_airline_name(airline_name)
    sd = result.get("sentiment_distribution") or {}
    analysis = AirlineDatasetAnalysis(
        airline_name=normalized,
        reviews_analyzed_count=len(review_ids),
        most_complained_topics=result.get("most_complained_topics") or [],
        most_liked_aspects=result.get("most_liked_aspects") or [],
        sentiment_positive=int(sd.get("positive", 0) or 0),
        sentiment_negative=int(sd.get("negative", 0) or 0),
        sentiment_neutral=int(sd.get("neutral", 0) or 0),
        preference_reasons=result.get("preference_reasons") or [],
        avoidance_reasons=result.get("avoidance_reasons") or [],
        customer_recommendations=result.get("customer_recommendations") or [],
        time_trends=result.get("time_trends") or [],
        route_satisfaction=result.get("route_satisfaction") or [],
        rating_analysis=result.get("rating_analysis") or {},
        title_themes=result.get("title_themes") or [],
        frequent_words=result.get("frequent_words") or [],
    )
    db.add(analysis)
    db.flush()

    # is_processed = True
    (
        db.query(AirlineDatasetReview)
        .filter(AirlineDatasetReview.id.in_(review_ids))
        .update({AirlineDatasetReview.is_processed: True}, synchronize_session=False)
    )

    for rid in review_ids:
        link = AirlineDatasetAnalysisReview(
            airline_dataset_analysis_id=analysis.id,
            dataset_review_id=rid,
        )
        db.add(link)

    db.commit()
    db.refresh(analysis)
    return analysis


def _merge_string_lists(*lists: list[list]) -> list[str]:
    """Birden fazla listeyi birleştirir, tekrarları ilk geçtiği yerde bırakır."""
    seen: set[str] = set()
    out: list[str] = []
    for lst in lists:
        for x in lst:
            if isinstance(x, str):
                s = x.strip()
                if s and s not in seen:
                    seen.add(s)
                    out.append(s)
    return out


def _merge_time_trends(batches: list[AirlineDatasetAnalysis]) -> list[dict]:
    """Dönem bazlı trendleri birleştirir (period key ile toplayarak)."""
    by_period: dict[str, dict[str, int]] = {}
    for b in batches:
        for item in b.time_trends or []:
            if not isinstance(item, dict):
                continue
            period = (item.get("period") or "").strip()
            if not period:
                continue
            if period not in by_period:
                by_period[period] = {"positive": 0, "negative": 0, "neutral": 0}
            by_period[period]["positive"] += int(item.get("positive") or 0)
            by_period[period]["negative"] += int(item.get("negative") or 0)
            by_period[period]["neutral"] += int(item.get("neutral") or 0)
    return [{"period": p, **v} for p, v in sorted(by_period.items())]


def _merge_route_satisfaction(batches: list[AirlineDatasetAnalysis]) -> list[dict]:
    """Rota bazlı memnuniyeti birleştirir (route key ile gruplayıp tek kayıt)."""
    by_route: dict[str, dict] = {}
    for b in batches:
        for item in b.route_satisfaction or []:
            if not isinstance(item, dict):
                continue
            route = (item.get("route") or "").strip()
            if not route:
                continue
            if route not in by_route:
                by_route[route] = {
                    "route": route,
                    "sentiment": item.get("sentiment") or "neutral",
                    "complaints": _merge_string_lists(item.get("complaints") or []),
                    "liked": _merge_string_lists(item.get("liked") or []),
                }
            else:
                by_route[route]["complaints"] = _merge_string_lists(
                    by_route[route]["complaints"],
                    item.get("complaints") or [],
                )
                by_route[route]["liked"] = _merge_string_lists(
                    by_route[route]["liked"],
                    item.get("liked") or [],
                )
    return list(by_route.values())


def _merge_frequent_words(
    batches: list[AirlineDatasetAnalysis],
    top_n: int = 30,
) -> list[str]:
    """Sık kelimeleri birleştirir, sayıya göre sıralayıp top_n döner."""
    from collections import Counter

    counter: Counter[str] = Counter()
    for b in batches:
        for w in b.frequent_words or []:
            if isinstance(w, str) and w.strip():
                counter[w.strip().lower()] += 1
    return [x[0] for x in counter.most_common(top_n)]


def _get_rating_and_time_trends_for_airline(db: Session, airline_name: str) -> dict[str, Any]:
    """
    Dataset tablosundaki ham yorumlardan puan ortalaması ve aylık yorum sayısı.
    (LLM analiziyle sınırlı değil; tüm kayıtlar üzerinden hesaplanır.)
    """
    q = db.query(
        AirlineDatasetReview.rating,
        AirlineDatasetReview.review_date,
    )
    if airline_name != "Tüm Havayolları":
        q = q.filter(AirlineDatasetReview.airline_name == airline_name)
    rows = q.all()
    if not rows:
        return {"rating_analysis": {}, "time_trends": []}

    ratings = [int(r[0]) for r in rows if r[0] is not None]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    variance = sum((x - avg_rating) ** 2 for x in ratings) / len(ratings) if ratings else 0
    std_dev = round(variance ** 0.5, 2) if variance else 0

    # Aylık yorum sayısı (YYYY-MM)
    by_period: dict[str, int] = {}
    for r in rows:
        dt = r[1]
        if not dt:
            continue
        period = dt.strftime("%Y-%m") if hasattr(dt, "strftime") else str(dt)[:7]
        by_period[period] = by_period.get(period, 0) + 1
    time_trends = [{"period": p, "review_count": c} for p, c in sorted(by_period.items())]

    return {
        "rating_analysis": {
            "average_rating": round(avg_rating, 2),
            "std_dev": std_dev,
            "review_count": len(rows),
        },
        "time_trends": time_trends,
    }

def get_aggregated_result_for_airline(db: Session, airline_name: str) -> dict[str, Any]:
    """
    Sadece belirtilen havayoluna ait batch sonuçlarını birleştirir.
    """
    normalized = _normalize_airline_name(airline_name)
    batches = (
        db.query(AirlineDatasetAnalysis)
        .filter(AirlineDatasetAnalysis.airline_name == normalized)
        .order_by(AirlineDatasetAnalysis.created_at.asc())
        .all()
    )
    if not batches:
        return dict(DEFAULT_AGGREGATED)

    total_positive = sum(b.sentiment_positive or 0 for b in batches)
    total_negative = sum(b.sentiment_negative or 0 for b in batches)
    total_neutral = sum(b.sentiment_neutral or 0 for b in batches)

    complained = _merge_string_lists(*[b.most_complained_topics or [] for b in batches])
    liked = _merge_string_lists(*[b.most_liked_aspects or [] for b in batches])
    preference = _merge_string_lists(*[b.preference_reasons or [] for b in batches])
    avoidance = _merge_string_lists(*[b.avoidance_reasons or [] for b in batches])
    recommendations = _merge_string_lists(*[b.customer_recommendations or [] for b in batches])
    time_trends = _merge_time_trends(batches)
    route_satisfaction = _merge_route_satisfaction(batches)
    title_themes = _merge_string_lists(*[b.title_themes or [] for b in batches])
    frequent_words = _merge_frequent_words(batches)

    rating_trends = _get_rating_and_time_trends_for_airline(db, airline_name)
    rating_analysis = rating_trends.get("rating_analysis") or {}
    if not time_trends and rating_trends.get("time_trends"):
        time_trends = rating_trends["time_trends"]

    return {
        "most_complained_topics": complained,
        "most_liked_aspects": liked,
        "sentiment_distribution": {
            "positive": total_positive,
            "negative": total_negative,
            "neutral": total_neutral,
        },
        "preference_reasons": preference,
        "avoidance_reasons": avoidance,
        "customer_recommendations": recommendations,
        "time_trends": time_trends,
        "route_satisfaction": route_satisfaction,
        "rating_analysis": rating_analysis,
        "title_themes": title_themes,
        "frequent_words": frequent_words,
    }


def get_airlines_with_analysis(db: Session) -> list[str]:
    """Analiz sonucu bulunan havayolu adlarını döndürür (distinct airline_name)."""
    rows = (
        db.query(AirlineDatasetAnalysis.airline_name)
        .distinct()
        .order_by(AirlineDatasetAnalysis.airline_name)
        .all()
    )
    return [r[0] or "Diğer" for r in rows if r[0]]


def get_aggregated_result_for_all_airlines(db: Session) -> dict[str, Any]:
    """
    Tüm havayollarına ait analiz batch sonuçlarını birleştirir (global görünüm).
    """
    batches = (
        db.query(AirlineDatasetAnalysis)
        .order_by(AirlineDatasetAnalysis.created_at.asc())
        .all()
    )
    if not batches:
        return dict(DEFAULT_AGGREGATED)

    total_positive = sum(b.sentiment_positive or 0 for b in batches)
    total_negative = sum(b.sentiment_negative or 0 for b in batches)
    total_neutral = sum(b.sentiment_neutral or 0 for b in batches)

    complained = _merge_string_lists(*[b.most_complained_topics or [] for b in batches])
    liked = _merge_string_lists(*[b.most_liked_aspects or [] for b in batches])
    preference = _merge_string_lists(*[b.preference_reasons or [] for b in batches])
    avoidance = _merge_string_lists(*[b.avoidance_reasons or [] for b in batches])
    recommendations = _merge_string_lists(*[b.customer_recommendations or [] for b in batches])
    time_trends = _merge_time_trends(batches)
    route_satisfaction = _merge_route_satisfaction(batches)
    title_themes = _merge_string_lists(*[b.title_themes or [] for b in batches])
    frequent_words = _merge_frequent_words(batches)

    rating_trends = _get_rating_and_time_trends_for_airline(db, "Tüm Havayolları")
    rating_analysis = rating_trends.get("rating_analysis") or {}
    if not time_trends and rating_trends.get("time_trends"):
        time_trends = rating_trends["time_trends"]

    return {
        "most_complained_topics": complained,
        "most_liked_aspects": liked,
        "sentiment_distribution": {
            "positive": total_positive,
            "negative": total_negative,
            "neutral": total_neutral,
        },
        "preference_reasons": preference,
        "avoidance_reasons": avoidance,
        "customer_recommendations": recommendations,
        "time_trends": time_trends,
        "route_satisfaction": route_satisfaction,
        "rating_analysis": rating_analysis,
        "title_themes": title_themes,
        "frequent_words": frequent_words,
    }


def get_multi_airline_overview(db: Session) -> list[dict[str, Any]]:
    """
    Havayolu bazında özet: toplam sentiment sayıları ve zaman trendleri.
    Çoklu havayolu karşılaştırma kartları ve grafikleri için kullanılır.
    """
    rows = (
        db.query(AirlineDatasetAnalysis)
        .order_by(AirlineDatasetAnalysis.created_at.asc())
        .all()
    )
    if not rows:
        return []

    by_airline: dict[str, dict[str, Any]] = {}
    for b in rows:
        name = b.airline_name or "Diğer"
        if name not in by_airline:
            by_airline[name] = {
                "airline_name": name,
                "sentiment_distribution": {"positive": 0, "negative": 0, "neutral": 0},
                "time_trends": {},
            }
        entry = by_airline[name]
        entry["sentiment_distribution"]["positive"] += int(b.sentiment_positive or 0)
        entry["sentiment_distribution"]["negative"] += int(b.sentiment_negative or 0)
        entry["sentiment_distribution"]["neutral"] += int(b.sentiment_neutral or 0)

        # time_trends: [{ period, positive, negative, neutral }]
        for item in b.time_trends or []:
            if not isinstance(item, dict):
                continue
            period = (item.get("period") or "").strip()
            if not period:
                continue
            if period not in entry["time_trends"]:
                entry["time_trends"][period] = {"positive": 0, "negative": 0, "neutral": 0}
            entry["time_trends"][period]["positive"] += int(item.get("positive") or 0)
            entry["time_trends"][period]["negative"] += int(item.get("negative") or 0)
            entry["time_trends"][period]["neutral"] += int(item.get("neutral") or 0)

    # time_trends dict'lerini listeye çevir ve review_count ekle
    out: list[dict[str, Any]] = []
    for name, data in by_airline.items():
        trends_list = []
        for period, vals in sorted(data["time_trends"].items()):
            review_count = (
                int(vals.get("positive") or 0)
                + int(vals.get("negative") or 0)
                + int(vals.get("neutral") or 0)
            )
            trends_list.append(
                {
                    "period": period,
                    "positive": int(vals.get("positive") or 0),
                    "negative": int(vals.get("negative") or 0),
                    "neutral": int(vals.get("neutral") or 0),
                    "review_count": review_count,
                }
            )
        out.append(
            {
                "airline_name": data["airline_name"],
                "sentiment_distribution": data["sentiment_distribution"],
                "time_trends": trends_list,
            }
        )
    return out



