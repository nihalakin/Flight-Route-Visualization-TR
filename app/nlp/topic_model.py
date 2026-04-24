from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Tuple, Dict, Any
import collections.abc as cabc

from bertopic import BERTopic
from sentence_transformers import SentenceTransformer


@dataclass
class TopicAssignment:
    index: int
    airline: str
    sentiment: str
    text: str
    topic_id: int
    probability: float | None


class AirlineTopicAnalyzer:
    """
    Türkçe havayolu yorumları için BERTopic tabanlı konu analizi.

    - Yorum metinlerini embedding'e çevirir (SentenceTransformer).
    - BERTopic ile topic discovery yapar.
    - Her yorum için topic id ve temsilci kelimeleri döner.
    """

    def __init__(
        self,
        model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
        language: str = "turkish",
        **bertopic_kwargs: Any,
    ) -> None:
        """
        SentenceTransformer ve BERTopic modellerini yükler.

        Model yüklemeleri initialize sırasında yapılır ki analiz script'i
        tekrar tekrar çağrıldığında her seferinde yeniden yüklenmesin.
        """
        self.model_name = model_name
        self.language = language

        # Embedding modeli
        self._st_model = SentenceTransformer(model_name)

        # BERTopic modeli
        default_kwargs: Dict[str, Any] = {
            "language": language,
            "calculate_probabilities": True,
            # Kullanıcının istediği varsayılan yapılandırma
            "min_topic_size": 5,
            "n_gram_range": (1, 2),
        }
        default_kwargs.update(bertopic_kwargs)
        self._topic_model = BERTopic(embedding_model=self._st_model, **default_kwargs)

    @property
    def topic_model(self) -> BERTopic:
        return self._topic_model

    def embed_texts(self, texts: Iterable[str]) -> List[List[float]]:
        """
        Yorum metinlerini embedding'e çevirir.

        Normalde BERTopic kendi içinde çağırsa da, gerektiğinde
        bağımsız embedding elde etmek için bu metot kullanılabilir.
        """
        return self._st_model.encode(
            list(texts), show_progress_bar=False, convert_to_numpy=False
        ).tolist()

    def fit_topics(
        self,
        documents: List[str],
    ) -> Tuple[List[int], List[float | None]]:
        """
        BERTopic ile konu keşfi yapar, her belge için topic id ve olasılık döner.
        """
        topics, probs = self._topic_model.fit_transform(documents)
        # probs, BERTopic sürümüne göre farklı tiplerde gelebilir:
        # - List[List[float]]
        # - List[float] / np.ndarray
        # - None
        max_probs: List[float | None] = []
        if probs is None:
            max_probs = [None] * len(topics)
        else:
            for row in probs:
                if row is None:
                    max_probs.append(None)
                    continue
                # Iterable değilse (örn. tek float / numpy.scalar) direkt kullan
                if not isinstance(row, cabc.Iterable) or isinstance(row, (str, bytes)):
                    try:
                        max_probs.append(float(row))
                    except Exception:
                        max_probs.append(None)
                    continue
                try:
                    max_probs.append(float(max(row)))
                except Exception:
                    max_probs.append(None)
        return topics, max_probs

    def topics_for_documents(
        self,
        documents: List[str],
    ) -> Tuple[List[int], List[float | None]]:
        """
        Zaten fit edilmiş bir BERTopic modeli varsa, yeni dokümanlara topic atar.
        """
        topics, probs = self._topic_model.transform(documents)
        max_probs: List[float | None] = []
        if probs is None:
            max_probs = [None] * len(topics)
        else:
            for row in probs:
                if row is None:
                    max_probs.append(None)
                    continue
                if not isinstance(row, cabc.Iterable) or isinstance(row, (str, bytes)):
                    try:
                        max_probs.append(float(row))
                    except Exception:
                        max_probs.append(None)
                    continue
                try:
                    max_probs.append(float(max(row)))
                except Exception:
                    max_probs.append(None)
        return topics, max_probs

    def summarize_topic(self, topic_id: int, top_n_words: int = 3) -> str:
        """
        Verilen topic id için temsilci kelimeleri döner.
        Örn: "bagaj, gecikme, valiz" gibi kısa bir özet.
        """
        if topic_id is None or topic_id == -1:
            return ""

        words = self._topic_model.get_topic(topic_id) or []

        # Havayolu isimlerini ve çok anlamsız token'ları filtrele
        airline_tokens = {
            "pegasus",
            "sunexpress",
            "sun",
            "express",
            "thy",
            "turkish",
            "airlines",
        }

        filtered: List[str] = []
        for w, _score in words:
            raw = (w or "").strip()
            token = raw.lower()
            if not token:
                continue
            if token in airline_tokens:
                continue
            # Tamamen sayısal veya tek karakterlik tokenları at
            if token.isdigit():
                continue
            if len(token) == 1:
                continue
            if token not in (t.lower() for t in filtered):
                filtered.append(raw)

        top_words = [w.strip() for w in filtered[:top_n_words] if w.strip()]
        # Virgülle ayrılmış etiket formatı
        return ", ".join(top_words)

