"""
Yorum analizi veritabanı işlemleri: Havayoluna göre analiz edilmemiş onaylı yorumları getir,
batch sonucunu havayolu ile kaydet, havayoluna göre agregasyon.
Zaman/rota/puan trendleri backend'de hesaplanır.
"""
from typing import Any

from sqlalchemy.orm import Session

from app.models import Comment, TicketSegment, UserReviewAnalysis, UserReviewAnalysisReview
from app.models.comment import COMMENT_STATUS_APPROVED

# Yorum öğesi: (id, content, title, rating, created_at, route)
ReviewItem = tuple[int, str, str | None, int, Any, str]

# Varsayılan boş sonuç (hiç analiz yoksa)
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


def _merge_string_lists(*lists: list[list]) -> list[str]:
    """Birden fazla listeyi birleştirir, sırayı korur, tekrarları ilk geçtiği yerde bırakır."""
    seen = set()
    out = []
    for lst in lists:
        for x in lst:
            if isinstance(x, str) and x.strip() and x.strip() not in seen:
                seen.add(x.strip())
                out.append(x.strip())
    return out


def _normalize_airline_name(name: str | None) -> str:
    """Havayolu adı boşsa 'Diğer' döner."""
    if not name or not str(name).strip():
        return "Diğer"
    return str(name).strip()


def _route_string(seg: TicketSegment) -> str:
    """Segmentten rota metni: departure – arrival."""
    dep = (seg.departure_city or seg.departure_airport_code or "").strip()
    arr = (seg.arrival_city or seg.arrival_airport_code or "").strip()
    if dep and arr:
        return f"{dep} – {arr}"
    return dep or arr or "Bilinmiyor"


def get_unanalyzed_approved_reviews_for_airline(
    db: Session,
    airline_name: str,
) -> list[ReviewItem]:
    """
    Belirtilen havayoluna ait, onaylı ve daha önce analiz edilmemiş yorumları döndürür.
    Returns: [(id, content, title, rating, created_at, route), ...]
    """
    analyzed_ids = db.query(UserReviewAnalysisReview.user_review_id).distinct().subquery()
    normalized = _normalize_airline_name(airline_name)
    q = (
        db.query(Comment, TicketSegment)
        .join(TicketSegment, TicketSegment.id == Comment.ticket_segment_id)
        .filter(Comment.status == COMMENT_STATUS_APPROVED, Comment.id.notin_(analyzed_ids))
    )
    if normalized == "Diğer":
        q = q.filter(
            (TicketSegment.airline_name.is_(None)) | (TicketSegment.airline_name == "")
        )
    else:
        q = q.filter(TicketSegment.airline_name == normalized)
    rows = q.order_by(Comment.created_at.asc()).all()
    out: list[ReviewItem] = []
    for c, seg in rows:
        content = (c.content or "").strip()
        if not content:
            continue
        route = _route_string(seg)
        created = c.created_at
        rating = int(c.rating) if c.rating is not None else 0
        title = (c.title or "").strip() or None
        out.append((c.id, content, title, max(1, min(5, rating)), created, route))
    return out


def get_airlines_with_unanalyzed_reviews(db: Session) -> list[str]:
    """Analiz edilmemiş onaylı yorumu olan havayolu adlarını döndürür (segment.airline_name)."""
    analyzed_ids = db.query(UserReviewAnalysisReview.user_review_id).distinct().subquery()
    rows = (
        db.query(TicketSegment.airline_name)
        .join(Comment, Comment.ticket_segment_id == TicketSegment.id)
        .filter(Comment.status == COMMENT_STATUS_APPROVED, Comment.id.notin_(analyzed_ids))
        .distinct()
        .all()
    )
    return sorted({_normalize_airline_name(r[0]) for r in rows})


def save_analysis_batch(
    db: Session,
    review_ids: list[int],
    result: dict[str, Any],
    airline_name: str,
) -> UserReviewAnalysis:
    """
    Bir batch analiz sonucunu belirtilen havayolu adıyla kaydeder.
    """
    normalized = _normalize_airline_name(airline_name)
    sd = result.get("sentiment_distribution") or {}
    analysis = UserReviewAnalysis(
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
    for rid in review_ids:
        link = UserReviewAnalysisReview(
            user_review_analysis_id=analysis.id,
            user_review_id=rid,
        )
        db.add(link)
    db.commit()
    db.refresh(analysis)
    return analysis


def _merge_time_trends(batches: list[UserReviewAnalysis]) -> list[dict]:
    """Dönem bazlı trendleri birleştirir (period key ile gruplayıp positive/negative/neutral toplar)."""
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


def _merge_route_satisfaction(batches: list[UserReviewAnalysis]) -> list[dict]:
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


def _merge_frequent_words(batches: list[UserReviewAnalysis], top_n: int = 30) -> list[str]:
    """Sık kelimeleri birleştirir, sayıya göre sıralayıp top_n döner."""
    from collections import Counter
    counter: Counter[str] = Counter()
    for b in batches:
        for w in b.frequent_words or []:
            if isinstance(w, str) and w.strip():
                counter[w.strip().lower()] += 1
    return [x[0] for x in counter.most_common(top_n)]


def get_aggregated_result_for_airline(db: Session, airline_name: str) -> dict[str, Any]:
    """
    Sadece belirtilen havayoluna ait batch sonuçlarını birleştirir.
    time_trends, route_satisfaction, title_themes, frequent_words dahil.
    """
    normalized = _normalize_airline_name(airline_name)
    batches = (
        db.query(UserReviewAnalysis)
        .filter(UserReviewAnalysis.airline_name == normalized)
        .order_by(UserReviewAnalysis.created_at.asc())
        .all()
    )
    if not batches:
        base = dict(DEFAULT_AGGREGATED)
        rating_trends = _get_rating_and_time_trends_for_airline(db, normalized)
        base["rating_analysis"] = rating_trends.get("rating_analysis") or {}
        base["time_trends"] = rating_trends.get("time_trends") or []
        return base

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

    # Rating ve zaman trendi (yorum sayısı) backend'den hesapla
    rating_trends = _get_rating_and_time_trends_for_airline(db, normalized)
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


def _get_rating_and_time_trends_for_airline(db: Session, airline_name: str) -> dict[str, Any]:
    """
    Havayoluna ait onaylı yorumlardan puan ortalaması, std sapma ve aylık yorum sayısı.
    (Analiz edilmiş yorumlarla sınırlı değil; tüm onaylı yorumlar.)
    """
    q = (
        db.query(Comment.id, Comment.rating, Comment.created_at)
        .join(TicketSegment, TicketSegment.id == Comment.ticket_segment_id)
        .filter(Comment.status == COMMENT_STATUS_APPROVED)
    )
    if airline_name == "Diğer":
        q = q.filter(
            (TicketSegment.airline_name.is_(None)) | (TicketSegment.airline_name == "")
        )
    else:
        q = q.filter(TicketSegment.airline_name == airline_name)
    rows = q.all()
    if not rows:
        return {"rating_analysis": {}, "time_trends": []}

    ratings = [int(r[1]) for r in rows if r[1] is not None]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    variance = sum((x - avg_rating) ** 2 for x in ratings) / len(ratings) if ratings else 0
    std_dev = round(variance ** 0.5, 2) if variance else 0

    # Aylık yorum sayısı (YYYY-MM)
    by_period: dict[str, int] = {}
    for r in rows:
        if r[2]:
            period = r[2].strftime("%Y-%m") if hasattr(r[2], "strftime") else str(r[2])[:7]
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


def get_airlines_with_analysis(db: Session) -> list[str]:
    """Analiz sonucu bulunan havayolu adlarını döndürür (distinct airline_name)."""
    rows = (
        db.query(UserReviewAnalysis.airline_name)
        .distinct()
        .order_by(UserReviewAnalysis.airline_name)
        .all()
    )
    return [r[0] or "Diğer" for r in rows if r[0]]
