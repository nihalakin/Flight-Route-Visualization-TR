from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models import AirlineDatasetReview


def get_dataset_reviews_grouped_by_airline(db: Session) -> Dict[str, Any]:
    """
    Dataset tablosundaki ham yorumları havayoluna göre gruplayarak döndürür.
    Frontend'de airline-reviews-dataset sayfasındaki yorum listelerini besler.
    """
    rows: List[AirlineDatasetReview] = (
        db.query(AirlineDatasetReview)
        .order_by(AirlineDatasetReview.airline_name.asc(), AirlineDatasetReview.review_date.asc())
        .all()
    )
    by_airline: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        airline = (r.airline_name or "").strip() or "Diğer"
        if airline not in by_airline:
            by_airline[airline] = []
        by_airline[airline].append(
            {
                "route": (r.route or "").strip() or "Bilinmiyor",
                "review_date": r.review_date.isoformat() if r.review_date else None,
                "title": (r.title or "").strip() or None,
                "content": (r.content or "").strip(),
                "rating": int(r.rating or 0),
                "username": (r.user_name or "").strip() or "Anonim",
                "user_total_reviews": r.contribution_count or None,
            }
        )
    result = {
        "by_airline": [
            {"airline_name": name, "reviews": reviews}
            for name, reviews in sorted(by_airline.items(), key=lambda x: x[0])
        ]
    }
    return result

