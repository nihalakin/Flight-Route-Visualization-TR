"""
Havayolu yorumlarını OpenRouter (Gemma 3 27B) ile analiz eder.
Çıktı: duygu, şikayet/beğeni, tavsiyeler, zaman/rota trendleri, başlık temaları, sık kelimeler.
"""
import json
import logging
from typing import Any

import httpx

from app.core.config import OPENROUTER_API_KEY, OPENROUTER_MODEL

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# review_items: (id, content, title, rating, created_at, route)
ReviewItem = tuple[int, str, str | None, int, Any, str]

DEFAULT_RESPONSE = {
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


def _build_system_prompt() -> str:
    return """Sen bir havayolu müşteri deneyimi analiz uzmanısın. Her yorum için başlık, puan, tarih, rota ve içerik verilecek.
Çıktını MUTLAKA aşağıdaki JSON yapısında ve SADECE bu JSON'u döndür (başka metin veya markdown ekleme):

{
  "sentiment_distribution": { "positive": sayi, "negative": sayi, "neutral": sayi },
  "most_complained_topics": ["Başlık 1: kısa açıklama", "Başlık 2: kısa açıklama", ...],
  "most_liked_aspects": ["Başlık 1: kısa açıklama", "Başlık 2: kısa açıklama", ...],
  "customer_recommendations": ["tavsiye1", "tavsiye2", ...],
  "preference_reasons": ["sebep1", ...],
  "avoidance_reasons": ["sebep1", ...],
  "time_trends": [{"period": "YYYY-MM", "positive": n, "negative": n, "neutral": n}, ...],
  "route_satisfaction": [{"route": "A – B", "sentiment": "positive|negative|neutral", "complaints": [], "liked": []}, ...],
  "rating_analysis": {"average_rating": 4.2, "sentiment_consistency": "high|medium|low", "note": "kısa not"},
  "title_themes": ["tema1", "tema2", ...],
  "frequent_words": ["kelime1", "kelime2", ...]
}

Kurallar:
- sentiment_distribution: positive + negative + neutral = toplam yorum sayısı. Her yorumu tek bir duyguya (positive/negative/neutral) sınıflandır.
- most_complained_topics: SADECE yazarın kendi yaşadığı olumsuz deneyimler. "Başkaları şikayet etti" sayılmaz. En fazla 10 madde.
- most_liked_aspects: Övülen unsurlar. En fazla 10 madde.
- most_complained_topics ve most_liked_aspects içindeki HER madde şu formatta olmalıdır: "Kısa Başlık: yorumlardan çıkan 1–2 cümlelik kısa analiz ve mümkünse oran/sıklık bilgisi (örn. olumlu yorumların %40'ında bahsedilmiştir)".
- customer_recommendations: Yolcuların diğer yolculara tavsiyeleri. En fazla 8 madde.
- time_trends: Yorum tarihine (period: YYYY-MM) göre o aydaki positive/negative/neutral sayıları. Verilen yorumların tarihlerine göre doldur.
- route_satisfaction: Rota bazında (verilen rotalar) genel sentiment ve o rotada öne çıkan complaints/liked. Her benzersiz rota için bir öğe.
- rating_analysis: Yorumlardaki puanların ortalaması (1-5), puan ile duygu tutarlılığı (high/medium/low), kısa note.
- title_themes: Başlıklardan çıkan temalar (örn. "konfor", "fiyat", "hizmet"). En fazla 8.
- frequent_words: İçeriklerde sık geçen anlamlı kelimeler (stop word değil). Kelime bulutu için. En fazla 25 kelime.
Tüm metinler Türkçe. Sadece geçerli JSON döndür."""


def _build_user_message_from_items(review_items: list[ReviewItem]) -> str:
    if not review_items:
        return "Analiz edilecek yorum yok."
    lines = []
    for i, item in enumerate(review_items, 1):
        _id, content, title, rating, created_at, route = item
        date_str = created_at.strftime("%Y-%m-%d") if hasattr(created_at, "strftime") else str(created_at)[:10]
        title_str = (title or "-").strip()
        lines.append(
            f"Yorum {i}: Başlık: {title_str} | Puan: {rating}/5 | Tarih: {date_str} | Rota: {route}\nİçerik: {content}"
        )
    return "Aşağıdaki havayolu yorumlarını analiz et ve istenen JSON çıktısını ver.\n\n" + "\n\n".join(lines)


def _parse_model_response(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if "```" in raw:
        start = raw.find("```")
        if start != -1:
            rest = raw[start + 3:]
            if rest.lower().startswith("json"):
                rest = rest[4:].lstrip()
            end = rest.find("```")
            raw = rest[:end].strip() if end != -1 else rest.strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("OpenRouter JSON parse hatası: %s", e)
        return dict(DEFAULT_RESPONSE)

    result = dict(DEFAULT_RESPONSE)
    if isinstance(data.get("most_complained_topics"), list):
        result["most_complained_topics"] = [str(x) for x in data["most_complained_topics"] if x]
    if isinstance(data.get("most_liked_aspects"), list):
        result["most_liked_aspects"] = [str(x) for x in data["most_liked_aspects"] if x]
    if isinstance(data.get("sentiment_distribution"), dict):
        sd = data["sentiment_distribution"]
        result["sentiment_distribution"] = {
            "positive": int(sd.get("positive", 0)) if sd.get("positive") is not None else 0,
            "negative": int(sd.get("negative", 0)) if sd.get("negative") is not None else 0,
            "neutral": int(sd.get("neutral", 0)) if sd.get("neutral") is not None else 0,
        }
    if isinstance(data.get("preference_reasons"), list):
        result["preference_reasons"] = [str(x) for x in data["preference_reasons"] if x]
    if isinstance(data.get("avoidance_reasons"), list):
        result["avoidance_reasons"] = [str(x) for x in data["avoidance_reasons"] if x]
    if isinstance(data.get("customer_recommendations"), list):
        result["customer_recommendations"] = [str(x) for x in data["customer_recommendations"] if x]
    if isinstance(data.get("time_trends"), list):
        result["time_trends"] = [
            {k: v for k, v in x.items() if isinstance(x, dict)}
            for x in data["time_trends"]
            if isinstance(x, dict)
        ]
    if isinstance(data.get("route_satisfaction"), list):
        result["route_satisfaction"] = [
            {k: v for k, v in x.items() if isinstance(x, dict)}
            for x in data["route_satisfaction"]
            if isinstance(x, dict)
        ]
    if isinstance(data.get("rating_analysis"), dict):
        result["rating_analysis"] = {k: v for k, v in data["rating_analysis"].items()}
    if isinstance(data.get("title_themes"), list):
        result["title_themes"] = [str(x) for x in data["title_themes"] if x]
    if isinstance(data.get("frequent_words"), list):
        result["frequent_words"] = [str(x) for x in data["frequent_words"] if x]
    return result


class ReviewAnalysisError(Exception):
    pass


async def analyze_reviews(review_items: list[ReviewItem]) -> dict[str, Any]:
    """
    OpenRouter Gemma 3 27B ile yorumları analiz eder.
    review_items: [(id, content, title, rating, created_at, route), ...]
    """
    if not review_items:
        return dict(DEFAULT_RESPONSE)

    api_key = (OPENROUTER_API_KEY or "").strip()
    if not api_key:
        raise ReviewAnalysisError(
            "OpenRouter API anahtarı tanımlı değil. .env dosyasına OPENROUTER_API_KEY ekleyin."
        )

    user_content = _build_user_message_from_items(review_items)
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": _build_system_prompt()},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                OPENROUTER_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://nodia.app",
                },
            )
            resp.raise_for_status()
            body = resp.json()
    except httpx.HTTPStatusError as e:
        msg = e.response.text[:500] if e.response.text else str(e)
        logger.error("OpenRouter HTTP hatası: %s %s", e.response.status_code, msg)
        raise ReviewAnalysisError(
            f"OpenRouter API hatası ({e.response.status_code}). Lütfen API anahtarını ve kotanızı kontrol edin."
        ) from e
    except httpx.RequestError as e:
        logger.exception("OpenRouter istek hatası: %s", e)
        raise ReviewAnalysisError("OpenRouter'a bağlanılamadı. İnternet bağlantısını kontrol edin.") from e
    except Exception as e:
        logger.exception("OpenRouter beklenmeyen hata: %s", e)
        raise ReviewAnalysisError("Analiz sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.") from e

    choices = body.get("choices") or []
    if not choices:
        raise ReviewAnalysisError("OpenRouter model yanıt vermedi. Lütfen daha sonra tekrar deneyin.")
    content = (choices[0].get("message") or {}).get("content") or ""
    if not content.strip():
        raise ReviewAnalysisError("OpenRouter boş içerik döndü. Lütfen daha sonra tekrar deneyin.")
    return _parse_model_response(content)
