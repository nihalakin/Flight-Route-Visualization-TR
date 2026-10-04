"""
Yorum analizi veritabanı işlemleri: Havayoluna göre analiz edilmemiş onaylı yorumları getir,
batch sonucunu havayolu ile kaydet, havayoluna göre agregasyon.
Zaman/rota/puan trendleri backend'de hesaplanır.
"""
from typing import Any

from sqlalchemy.orm import Session

from app.models import Comment, TicketSegment, UserReviewAnalysis, UserReviewAnalysisReview
from app.models.comment import COMMENT_STATUS_APPROVED
from app.utils.analysis_utils import (
    DEFAULT_AGGREGATED,
    ReviewItem,
    build_aggregated_response,
    merge_frequent_words,
    merge_route_satisfaction,
    merge_time_trends,
    normalize_airline_name,
)
from app.utils.text_utils import merge_string_lists


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
    normalized = normalize_airline_name(airline_name)
    analyzed_ids = db.query(UserReviewAnalysisReview.user_review_id).distinct().subquery()
    q = (
        db.query(Comment, TicketSegment)
        .join(TicketSegment, TicketSegment.id == Comment.ticket_segment_id)
        .filter(
            Comment.status == COMMENT_STATUS_APPROVED,
            Comment.is_analyzed.is_(False),
            Comment.id.notin_(analyzed_ids),
        )
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


def get_unanalyzed_reviews(db: Session) -> list[ReviewItem]:
    """
    Onaylı ve henüz analiz edilmemiş yorumları döndürür.
    Bekleyen veya reddedilen yorumlar modele gönderilmez.
    """
    analyzed_ids = db.query(UserReviewAnalysisReview.user_review_id).distinct().subquery()
    rows = (
        db.query(Comment, TicketSegment)
        .join(TicketSegment, TicketSegment.id == Comment.ticket_segment_id)
        .filter(
            Comment.status == COMMENT_STATUS_APPROVED,
            Comment.is_analyzed.is_(False),
            Comment.id.notin_(analyzed_ids),
        )
        .order_by(Comment.created_at.asc())
        .all()
    )
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


def get_unanalyzed_reviews_count(db: Session) -> int:
    """Onaylı ve henüz analiz edilmemiş yorum adedi."""
    analyzed_ids = db.query(UserReviewAnalysisReview.user_review_id).distinct().subquery()
    return (
        db.query(Comment)
        .filter(
            Comment.status == COMMENT_STATUS_APPROVED,
            Comment.is_analyzed.is_(False),
            Comment.id.notin_(analyzed_ids),
        )
        .count()
    )


def get_airlines_with_unanalyzed_reviews(db: Session) -> list[str]:
    """Analiz edilmemiş onaylı yorumu olan havayolu adlarını döndürür (segment.airline_name)."""
    analyzed_ids = db.query(UserReviewAnalysisReview.user_review_id).distinct().subquery()
    rows = (
        db.query(TicketSegment.airline_name)
        .join(Comment, Comment.ticket_segment_id == TicketSegment.id)
        .filter(
            Comment.status == COMMENT_STATUS_APPROVED,
            Comment.is_analyzed.is_(False),
            Comment.id.notin_(analyzed_ids),
        )
        .distinct()
        .all()
    )
    return sorted({normalize_airline_name(r[0]) for r in rows})


def save_analysis_batch(
    db: Session,
    review_ids: list[int],
    result: dict[str, Any],
    airline_name: str,
) -> UserReviewAnalysis:
    """
    Bir batch analiz sonucunu belirtilen havayolu adıyla kaydeder.
    """
    normalized = normalize_airline_name(airline_name)
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
    if review_ids:
        (
            db.query(Comment)
            .filter(Comment.id.in_(review_ids))
            .update({Comment.is_analyzed: True}, synchronize_session=False)
        )
    db.commit()
    db.refresh(analysis)
    return analysis


def get_aggregated_result_for_airline(db: Session, airline_name: str) -> dict[str, Any]:
    """
    Sadece belirtilen havayoluna ait batch sonuçlarını birleştirir.
    time_trends, route_satisfaction, title_themes, frequent_words dahil.
    """
    normalized = normalize_airline_name(airline_name)
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

    complained = merge_string_lists(*[b.most_complained_topics or [] for b in batches])
    liked = merge_string_lists(*[b.most_liked_aspects or [] for b in batches])
    preference = merge_string_lists(*[b.preference_reasons or [] for b in batches])
    avoidance = merge_string_lists(*[b.avoidance_reasons or [] for b in batches])
    recommendations = merge_string_lists(*[b.customer_recommendations or [] for b in batches])
    time_trends = merge_time_trends(batches)
    route_satisfaction = merge_route_satisfaction(batches)
    title_themes = merge_string_lists(*[b.title_themes or [] for b in batches])
    frequent_words = merge_frequent_words(batches)

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
