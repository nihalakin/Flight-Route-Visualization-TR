"""
Havayolu yorum analizi için ortak fonksiyonlar.
Kullanıcı yorumları ve dataset analizi modülleri tarafından paylaşılır.
"""

from typing import Any


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


def normalize_airline_name(name: str | None) -> str:
    """Havayolu adı boşsa 'Diğer' döner."""
    if not name or not str(name).strip():
        return "Diğer"
    return str(name).strip()


def merge_time_trends(batches: list[Any]) -> list[dict]:
    """
    Dönem bazlı trendleri birleştirir (period key ile gruplayıp positive/negative/neutral toplar).
    
    Args:
        batches: Analiz batch'leri (time_trends özelliği olan objeler)
    
    Returns:
        Birleştirilmiş zaman trendleri listesi
    """
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


def merge_route_satisfaction(batches: list[Any]) -> list[dict]:
    """
    Rota bazlı memnuniyeti birleştirir (route key ile gruplayıp tek kayıt).
    
    Args:
        batches: Analiz batch'leri (route_satisfaction özelliği olan objeler)
    
    Returns:
        Birleştirilmiş rota memnuniyeti listesi
    """
    from app.utils.text_utils import merge_string_lists
    
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
                    "complaints": merge_string_lists(item.get("complaints") or []),
                    "liked": merge_string_lists(item.get("liked") or []),
                }
            else:
                by_route[route]["complaints"] = merge_string_lists(
                    by_route[route]["complaints"],
                    item.get("complaints") or [],
                )
                by_route[route]["liked"] = merge_string_lists(
                    by_route[route]["liked"],
                    item.get("liked") or [],
                )
    return list(by_route.values())


def merge_frequent_words(batches: list[Any], top_n: int = 30) -> list[str]:
    """
    Sık kelimeleri birleştirir, sayıya göre sıralayıp top_n döner.
    
    Args:
        batches: Analiz batch'leri (frequent_words özelliği olan objeler)
        top_n: Döndürülecek maksimum kelime sayısı
    
    Returns:
        En sık geçen top_n kelime listesi
    """
    from collections import Counter
    
    counter: Counter[str] = Counter()
    for b in batches:
        for w in b.frequent_words or []:
            if isinstance(w, str) and w.strip():
                counter[w.strip().lower()] += 1
    return [x[0] for x in counter.most_common(top_n)]


def build_aggregated_response(
    batches: list[Any],
    time_trends: list[dict],
    route_satisfaction: list[dict],
    rating_analysis: dict,
    frequent_words: list[str],
) -> dict[str, Any]:
    """
    Analiz batch'lerinden agregasyon sonucu oluşturur.
    
    Args:
        batches: Analiz batch'leri
        time_trends: Birleştirilmiş zaman trendleri
        route_satisfaction: Birleştirilmiş rota memnuniyeti
        rating_analysis: Puan analizi
        frequent_words: Sık kelimeler
    
    Returns:
        Agregasyon sonuç sözlüğü
    """
    from app.utils.text_utils import group_similar_topics, merge_string_lists
    
    total_positive = sum(b.sentiment_positive or 0 for b in batches)
    total_negative = sum(b.sentiment_negative or 0 for b in batches)
    total_neutral = sum(b.sentiment_neutral or 0 for b in batches)

    complained = group_similar_topics(merge_string_lists(*[b.most_complained_topics or [] for b in batches]))
    liked = group_similar_topics(merge_string_lists(*[b.most_liked_aspects or [] for b in batches]))
    preference = group_similar_topics(merge_string_lists(*[b.preference_reasons or [] for b in batches]))
    avoidance = group_similar_topics(merge_string_lists(*[b.avoidance_reasons or [] for b in batches]))
    recommendations = group_similar_topics(merge_string_lists(*[b.customer_recommendations or [] for b in batches]))
    title_themes = group_similar_topics(merge_string_lists(*[b.title_themes or [] for b in batches]))

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
