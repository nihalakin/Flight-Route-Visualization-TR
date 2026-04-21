from __future__ import annotations

import json
import re
import string
import sys
import unicodedata
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.nlp.topic_model import AirlineTopicAnalyzer

DATA_DIR = PROJECT_ROOT / "data"
INPUT_CSV = DATA_DIR / "airlines_reviews.csv"
OUTPUT_JSON = DATA_DIR / "airline_analysis_test.json"


# Basit ama işlevsel bir Türkçe stopword listesi + havayolu isimleri
TURKISH_STOPWORDS: set[str] = {
    "ve", "veya", "ile", "de", "da", "ki", "bu", "şu", "o", "bir", "iki", "üç",
    "çok", "az", "daha", "en", "için", "gibi", "mi", "mu", "mü", "mı", "ama",
    "fakat", "ancak", "çünkü", "ise", "eğer", "hem", "ne", "neden", "niçin",
    "nasıl", "hangi", "nerede", "nereye", "nerden", "ben", "sen", "o", "biz",
    "siz", "onlar", "bana", "sana", "ona", "bizi", "sizi", "onu", "olarak",
    "kadar", "sonra", "önce", "hemen", "zaten", "yada", "şimdi", "daha", "hep",
    "her", "hiç", "yok", "var", "yalnız", "sadece", "bile",
    # Havayolu adları / varyantları – topic modellemeden çıkarılacak
    "pegasus", "sunexpress", "sun", "express", "thy", "turkish", "airlines",
}

# Topic keyword listesinde görmek istemediğimiz, çok genel/anlamsız kelimeler
TOPIC_KEYWORD_STOPWORDS: set[str] = {
    "nedeniyle",
    "edildi",
    "edilen",
    "ettiler",
    "ettik",
    "ettim",
    "ettiklerini",
    "diger",
    "diğer",
    "hersey",
    "herşey",
    "gibi",
    "falan",
    "filan",
    "vs",
    "vb",
    "seyehat",
    "seyahat",
    "ucus",
    "uçuş",
}


def normalize_sentiment(raw: Any) -> str:
    """
    CSV'deki duygu etiketini (Türkçe/İngilizce karışık olabilir) normalize eder.
    """
    if raw is None:
        return "neutral"
    s = str(raw).strip().lower()
    if s in {"olumlu", "positive", "pozitif", "pos"}:
        return "positive"
    if s in {"olumsuz", "negative", "neg"}:
        return "negative"
    if s in {"nötr", "notr", "neutral", "neu"}:
        return "neutral"
    return "neutral"


def preprocess_text(text: str) -> str:
    """
    Türkçe metin ön işleme:
    - Küçük harfe çevirme
    - Noktalama ve sayıları kaldırma
    - Türkçe stopword temizliği
    """
    if not isinstance(text, str):
        text = str(text or "")

    # Unicode normalizasyonu (örn. kombinasyonlu karakterler için)
    text = unicodedata.normalize("NFKC", text)

    # Türkçe karakter normalizasyonu (özellikle I/İ/ı varyantları)
    text = text.replace("İ", "i").replace("I", "i").replace("ı", "i")

    # Küçük harfe çevir
    text = text.lower()

    # Noktalama ve sayıları kaldır
    # Önce noktalama işaretlerini boşlukla değiştir
    punctuation_pattern = f"[{re.escape(string.punctuation)}]"
    text = re.sub(punctuation_pattern, " ", text)
    # Sayıları kaldır
    text = re.sub(r"\d+", " ", text)

    # Fazla boşlukları daralt
    text = re.sub(r"\s+", " ", text).strip()

    # Stopword temizliği
    tokens = [t for t in text.split() if t not in TURKISH_STOPWORDS]
    return " ".join(tokens)


def _generate_topic_title_from_keywords(keywords: List[str]) -> str:
    """
    Basit başlık üretici.

    Not: Gerçek bir üretim ortamında burada bir LLM entegrasyonu
    (örn. OpenAI, local model vb.) kullanarak Türkçe, anlamlı
    konu isimleri üretilebilir. Şimdilik heuristik bir yaklaşım kullanıyoruz.
    """
    if not keywords:
        return "Genel Konu"

    # Aynı kelimeleri tekrar etmeyecek şekilde kısalt
    seen: set[str] = set()
    cleaned: List[str] = []
    for kw in keywords:
        token = kw.strip()
        if not token:
            continue
        lower = token.lower()
        if lower in seen:
            continue
        seen.add(lower)
        cleaned.append(token)

    if not cleaned:
        return "Genel Konu"

    core = " ".join(cleaned[:3])

    # Basit bir Türkçe başlık formatlama: ilk harfleri büyüt
    return core.title()


def compute_airline_stats(
    df: pd.DataFrame,
    analyzer: AirlineTopicAnalyzer,
) -> Dict[str, Any]:
    """
    Havayolu bazında sentiment dağılımı ve topic bazlı içgörüler üretir.

    JSON formatı:
    {
      "by_airline": [
        {
          "airline_name": "...",
          "total_reviews": 10,
          "positive": 2,
          "negative": 7,
          "neutral": 1,
          "top_negative_topics": [
            {"topic": "...", "keywords": [...], "count": 3},
            ...
          ],
          "top_positive_topics": [
            {"topic": "...", "keywords": [...], "count": 2},
            ...
          ]
        }
      ]
    }
    """
    result: Dict[str, Any] = {"by_airline": []}

    if df.empty:
        return result

    # Topic id -> (label, keywords) haritası (topic_id == -1 hariç)
    topic_meta: Dict[int, Dict[str, Any]] = {}
    unique_ids = {int(t) for t in df["topic"].unique() if t is not None and int(t) != -1}
    for tid in unique_ids:
        label_str = analyzer.summarize_topic(tid, top_n_words=5) or ""
        raw_keywords = [k.strip() for k in label_str.split(",") if k.strip()]
        # Topic keyword stopword'lerini ve tekrarları temizle
        seen_kw: set[str] = set()
        keywords: List[str] = []
        for kw in raw_keywords:
            norm = kw.lower()
            if norm in TOPIC_KEYWORD_STOPWORDS:
                continue
            if norm in seen_kw:
                continue
            seen_kw.add(norm)
            keywords.append(kw)
        if not keywords:
            continue
        # Topic ismi için heuristik başlık (isteğe bağlı LLM ile değiştirilebilir)
        title = _generate_topic_title_from_keywords(keywords)
        topic_meta[tid] = {"topic": title, "keywords": keywords}

    for airline, group in df.groupby("Havayolu"):
        airline = str(airline) if airline is not None else "Diğer"

        sentiments = group["sentiment_norm"].tolist()
        topics = group["topic"].tolist()

        total = len(group)
        pos = sum(1 for s in sentiments if s == "positive")
        neg = sum(1 for s in sentiments if s == "negative")
        neu = sum(1 for s in sentiments if s == "neutral")

        # Sadece geçerli topic'leri kullan (topic_id != -1)
        # Her topic için pozitif/negatif sayıları takip et
        sentiment_counts: Dict[int, Dict[str, int]] = {}

        for s, t in zip(sentiments, topics):
            if t is None:
                continue
            tid = int(t)
            if tid == -1:
                continue
            if tid not in topic_meta:
                continue
            entry = sentiment_counts.setdefault(tid, {"positive": 0, "negative": 0})
            if s == "negative":
                entry["negative"] += 1
            elif s == "positive":
                entry["positive"] += 1

        neg_topic_counts: Dict[int, int] = {}
        pos_topic_counts: Dict[int, int] = {}

        # Overlap'i azaltmak için topic'i baskın olduğu duyguya at
        for tid, cnts in sentiment_counts.items():
            pos_c = cnts["positive"]
            neg_c = cnts["negative"]
            if pos_c == 0 and neg_c == 0:
                continue
            # Eğer biri diğerinden belirgin biçimde büyükse (>= %20 fark), sadece o listeye ata
            if neg_c >= pos_c * 1.2:
                neg_topic_counts[tid] = neg_c
            elif pos_c >= neg_c * 1.2:
                pos_topic_counts[tid] = pos_c
            else:
                # Fark bariz değilse her iki listede de görünebilir
                if neg_c > 0:
                    neg_topic_counts[tid] = neg_c
                if pos_c > 0:
                    pos_topic_counts[tid] = pos_c

        def build_topic_list(counts: Dict[int, int], limit: int = 5) -> List[Dict[str, Any]]:
            items = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
            out: List[Dict[str, Any]] = []
            for tid, cnt in items:
                meta = topic_meta.get(tid)
                if not meta:
                    continue
                out.append(
                    {
                        "topic": meta["topic"],
                        "keywords": meta["keywords"],
                        "count": int(cnt),
                    }
                )
            return out

        top_negative_topics = build_topic_list(neg_topic_counts)
        top_positive_topics = build_topic_list(pos_topic_counts)

        # Müşterilerin tercih etme ve etmeme sebepleri (en baskın topic)
        top_reason_to_avoid = None
        if top_negative_topics:
            top_reason_to_avoid = {
                "topic": top_negative_topics[0]["topic"],
                "keywords": top_negative_topics[0]["keywords"],
            }

        top_reason_to_choose = None
        if top_positive_topics:
            top_reason_to_choose = {
                "topic": top_positive_topics[0]["topic"],
                "keywords": top_positive_topics[0]["keywords"],
            }

        result["by_airline"].append(
            {
                "airline_name": airline,
                "total_reviews": int(total),
                "positive": int(pos),
                "negative": int(neg),
                "neutral": int(neu),
                "top_negative_topics": top_negative_topics,
                "top_positive_topics": top_positive_topics,
                "top_reason_to_avoid": top_reason_to_avoid,
                "top_reason_to_choose": top_reason_to_choose,
            }
        )

    # Havayolu isimlerine göre sıralı tut
    result["by_airline"].sort(key=lambda x: x["airline_name"].lower())
    return result


def main() -> None:
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"CSV dosyası bulunamadı: {INPUT_CSV}")

    df = pd.read_csv(INPUT_CSV)
    if df.empty:
        print("CSV boş, analiz yapılmadı.")
        return

    # Test için ilk 200 yorumu analiz et (100–200 aralığında)
    df = df.head(600).copy()

    # Gerekli kolonlar (sentiment başlığı veri setinde biraz farklı yazılmış olabilir)
    required_base_cols = [
        "Havayolu",
        "Rota",
        "Başlık / Ana Tema",
        "Yorum İçeriği (Tam Metin - Türkçe)",
    ]
    missing_base = [c for c in required_base_cols if c not in df.columns]
    if missing_base:
        raise ValueError(f"Eksik kolonlar: {missing_base}")

    # Sentiment kolonu isim varyantlarını kontrol et
    sentiment_col = None
    for cand in ["Olumlu / Olumsuz / Nötr", "Olumlu/Olumsuz/Nötr", "sentiment", "Sentiment"]:
        if cand in df.columns:
            sentiment_col = cand
            break
    if sentiment_col is None:
        raise ValueError("Sentiment kolonu bulunamadı. Beklenen başlıklardan biri: 'Olumlu/Olumsuz/Nötr' vb.")

    # Sentiment normalizasyonu
    df["sentiment_norm"] = df[sentiment_col].apply(normalize_sentiment)

    # Analiz edilecek metin: title + yorum içeriği, ardından Türkçe ön işleme
    raw_texts: List[str] = (
        df["Başlık / Ana Tema"].fillna("").astype(str)
        + " "
        + df["Yorum İçeriği (Tam Metin - Türkçe)"].fillna("").astype(str)
    ).tolist()
    texts: List[str] = [preprocess_text(t) for t in raw_texts]

    # BERTopic yapılandırması: min_topic_size=5, n_gram_range=(1, 2)
    analyzer = AirlineTopicAnalyzer(min_topic_size=5, n_gram_range=(1, 2))

    # BERTopic ile topic discovery
    topics, probs = analyzer.fit_topics(texts)
    df["topic"] = topics
    df["topic_prob"] = probs

    # Havayolu bazlı istatistikler (topic_id == -1 olan yorumlar,
    # topic bazlı analizde kullanılmayacak)
    stats = compute_airline_stats(df, analyzer)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"Analiz tamamlandı. Çıktı: {OUTPUT_JSON}")


if __name__ == "__main__":
    main()

