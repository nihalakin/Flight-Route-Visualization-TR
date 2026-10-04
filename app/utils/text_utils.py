"""Text processing utilities for topic grouping and similarity analysis."""

import re
from typing import Any


# Eş anlamlı kelime grupları
SYNONYM_GROUPS: list[list[str]] = [
    # Bagaj / Bavul grubu
    ['bavul', 'valiz', 'eşya', 'bagaj', 'çanta', 'suitcase', 'luggage', 'baggage'],
    ['kaybı', 'kaybolma', 'kayboluyor', 'kayıp', 'kayboldu', 'kaybetme'],
    ['hasarı', 'hasar', 'kırılma', 'kırık', 'zarar', 'zarar görmüş', 'parça'],
    # Gecikme / Rötar grubu
    ['gecikme', 'gecikmeli', 'rötar', 'erteleme', 'geç', 'geç kaldı', 'geç kalktı', 'geciken', 'rötarsız'],
    ['gecikti', 'ertelendi', 'süresiz', 'süresiz bekleyiş', 'bekleme', 'bekletme'],
    # Fiyat / Ücret / Maliyet grubu
    ['fiyat', 'ücret', 'maliyet', 'bedel', 'bilet', 'ücretli', 'fiyatlandırma', 'ekstra', 'masraf', 'fazla ücret', 'para', 'ücret talep', 'ek ücret', 'fahiş'],
    ['pahalı', 'ucuz', 'değer', 'ekonomik', 'indirim', 'kampanya'],
    # Müşteri / Yolcu Hizmetleri grubu
    ['müşteri', 'yolcu', 'müşteriler', 'yolcular', 'müşteri hizmetleri', 'destek', 'yardım'],
    ['hizmet', 'servis', 'hizmet kalitesi', 'hizmet anlayışı'],
    ['şikayet', 'şikayetim', 'sorun', 'problem', 'sıkıntı'],
    # Yemek / Catering grubu
    ['yemek', 'catering', 'gıda', 'yiyecek', 'ikram', 'açık büfe', 'yemek servisi', 'içecek'],
    # Personel / Çalışan grubu
    ['personel', 'hostes', 'hostesler', 'görevli', 'çalışan', 'kabin ekibi', 'pilot', 'ekip'],
    ['davranış', 'nezaket', 'saygı', 'ilgi', 'ilgisiz', 'kaba', 'nazik'],
    # Koltuk / Konfor grubu
    ['koltuk', 'koltuklar', 'oturma', 'yer', 'konfor', 'rahatlık', 'sıkışık', 'dar'],
    ['uçak', 'uçaklar', 'uçuş', 'sefer', 'flight', 'aircraft', 'uçuş deneyimi'],
    # Temizlik / Hijyen grubu
    ['temizlik', 'kirli', 'pis', 'hijyen', 'temiz', 'bakımsız'],
    # Check-in / Biniş grubu
    ['check', 'checkin', 'check-in', 'kontrol', 'biniş', 'giriş', 'kapı', 'counter'],
    # Bilgilendirme / İletişim grubu
    ['bilgilendirme', 'bilgi', 'duyuru', 'anons', 'haber verme', 'açıklama', 'bilgilendirmedikleri'],
    ['yanlış bilgi', 'hatalı bilgilendirme', 'yetersiz bilgi', 'bilgi eksikliği'],
    # Sağlık / Müdahale grubu
    ['sağlık', 'hastalık', 'doktor', 'ilkyardım', 'ambulans', 'müdahale', 'sağlık sorunu'],
    # Online / Dijital Hizmetler grubu
    ['online', 'internet', 'web', 'site', 'uygulama', 'app', 'mobil', 'dijital'],
    # Koltuk seçimi / Rezervasyon grubu
    ['rezervasyon', 'koltuk seçimi', 'seat selection', 'koltuk numarası', 'oturma düzeni'],
    # İptal / Değişiklik grubu
    ['iptal', 'iptal edildi', 'değişiklik', 'değiştirme', 'flight change', 'cancel'],
    # Güvenlik grubu
    ['güvenlik', 'güvenli', 'emniyet', 'risk', 'tehlike', 'korku', 'turbulans'],
]


def normalize_for_grouping(text: str) -> str:
    """Metni gruplama için normalize eder."""
    text = text.lower()
    # Türkçe karakterleri koru, diğer özel karakterleri boşluğa çevir
    text = re.sub(r'[^\w\sğüşıöç]', ' ', text)
    # Fazla boşlukları temizle
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def get_topic_keywords(text: str) -> list[str]:
    """Metinden anahtar kelimeleri çıkarır (2+ karakter)."""
    normalized = normalize_for_grouping(text)
    return [w for w in normalized.split() if len(w) > 2]


def expand_with_synonyms(words: list[str]) -> list[str]:
    """Kelime listesini eş anlamlılarıyla genişletir."""
    expanded = words.copy()
    for w in words:
        for group in SYNONYM_GROUPS:
            if w in group:
                for synonym in group:
                    if synonym not in expanded:
                        expanded.append(synonym)
    return expanded


def are_topics_similar(text1: str, text2: str, threshold: float = 0.25) -> bool:
    """
    İki konunun benzer olup olmadığını kontrol eder.
    
    Args:
        text1: Birinci konu başlığı
        text2: İkinci konu başlığı
        threshold: Benzerlik eşiği (varsayılan 0.25 = %25)
    
    Returns:
        True if topics are similar enough to be grouped
    """
    t1 = normalize_for_grouping(text1)
    t2 = normalize_for_grouping(text2)
    
    # Tam eşleşme veya içerme
    if t1 == t2:
        return True
    if t1 in t2 or t2 in t1:
        return True
    
    # Kategori kontrolü - farklı kategoriler asla birleştirilmemeli
    category_keywords = {
        'timeliness': ['zaman', 'zamanında', 'rötar', 'gecikme', 'geç', 'erteleme', 'saa'],
        'cleanliness': ['temiz', 'hijyen', 'bakım', 'bakımlı', 'düzen', 'düzenli', 'düzgün', 'pis', 'kirli', 'tuvalet'],
        'comfort': ['konfor', 'rahat', 'rahatlık', 'koltuk', 'bacak', 'mesafe', 'yastık', 'battaniye', 'keyifli'],
        'network': ['ağ', 'rota', 'nokta', 'ulaş', 'yer', 'şehir', 'havalimanı'],
        'safety': ['güvenlik', 'emniyet', 'güvenli', 'risk', 'tehlike', 'korku']
    }
    
    def detect_category(text):
        text_lower = text.lower()
        scores = {}
        for cat, keywords in category_keywords.items():
            scores[cat] = sum(1 for kw in keywords if kw in text_lower)
        max_cat = max(scores, key=scores.get)
        return max_cat if scores[max_cat] > 0 else None
    
    cat1 = detect_category(text1)
    cat2 = detect_category(text2)
    
    # Eğer her ikisi de farklı kategorilerse ve puanları yüksekse, birleştirme
    if cat1 and cat2 and cat1 != cat2:
        return False
    
    # Anahtar kelime benzerliği
    words1 = get_topic_keywords(text1)
    words2 = get_topic_keywords(text2)
    
    expanded1 = expand_with_synonyms(words1)
    expanded2 = expand_with_synonyms(words2)
    
    # Ortak kelime sayısı
    common = sum(1 for w in expanded1 if w in expanded2)
    
    # Benzerlik oranı
    if not expanded1 and not expanded2:
        return False
    similarity = common / max(len(expanded1), len(expanded2))
    return similarity >= threshold


def merge_descriptions(existing: str, new: str, max_sentences: int = 4) -> str:
    """İki açıklamayı birleştirir, tekrarları çıkarır ve maksimum 3-4 cümle ile sınırlar."""
    if not existing:
        return _limit_sentences(new, max_sentences)
    if not new:
        return _limit_sentences(existing, max_sentences)
    if new in existing:
        return _limit_sentences(existing, max_sentences)
    if existing in new:
        return _limit_sentences(new, max_sentences)
    
    combined = existing + '\n' + new
    return _limit_sentences(combined, max_sentences)


def _limit_sentences(text: str, max_sentences: int = 4) -> str:
    """Metni cümlelere ayırır, benzerleri çıkarır ve maksimum cümle sayısıyla sınırlar."""
    if not text:
        return text
    
    # Cümleleri ayır (nokta, ünlem, soru işareti ile)
    import re
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if len(sentences) <= max_sentences:
        return text
    
    # Benzer cümleleri çıkar (basit normalize edilmiş karşılaştırma)
    unique_sentences = []
    seen_normalized = set()
    
    for sent in sentences:
        # Normalize for comparison
        normalized = sent.lower()
        normalized = re.sub(r'[^\w\s]', '', normalized)  # Noktalama kaldır
        normalized = re.sub(r'\s+', ' ', normalized).strip()  # Boşluk düzenle
        
        # Eğer çok benzer bir cümle varsa atla (80%+ overlap)
        is_duplicate = False
        for seen in seen_normalized:
            if _text_similarity(normalized, seen) > 0.8:
                is_duplicate = True
                break
        
        if not is_duplicate:
            seen_normalized.add(normalized)
            unique_sentences.append(sent)
        
        # Maksimuma ulaştıysak dur
        if len(unique_sentences) >= max_sentences:
            break
    
    return '. '.join(unique_sentences) + '.' if unique_sentences else text


def _text_similarity(str1: str, str2: str) -> float:
    """İki metin arasındaki basit benzerlik oranı (0-1)."""
    if not str1 or not str2:
        return 0.0
    
    words1 = set(str1.split())
    words2 = set(str2.split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    return len(intersection) / len(union)


def group_similar_topics(items: list[str], limit: int | None = None) -> list[str]:
    """
    Benzer konuları gruplar.
    
    "Başlık: Açıklama" formatındaki öğeleri benzerliklerine göre birleştirir.
    Eş anlamlı kelime grupları kullanarak akıllı gruplama yapar.
    
    Args:
        items: Gruplanacak konu listesi
        limit: Maksimum dönülecek grup sayısı (None = sınırsız)
    
    Returns:
        Gruplanmış konu listesi
    """
    groups: list[dict[str, Any]] = []
    
    for item in items:
        raw = str(item or '').strip()
        if not raw:
            continue
        
        # "Başlık: Açıklama" formatını ayır
        idx = raw.find(':')
        if idx > 0:
            title = raw[:idx].strip()
            desc = raw[idx + 1:].strip()
        else:
            title = raw
            desc = ''
        
        # Benzer bir grup var mı?
        found_group = None
        for g in groups:
            if are_topics_similar(g['title'], title):
                found_group = g
                break
        
        if found_group:
            found_group['desc'] = merge_descriptions(found_group['desc'], desc)
        else:
            groups.append({
                'title': title,
                'desc': desc,
                'full': raw
            })
    
    # Sonucu oluştur
    result: list[str] = []
    for g in groups:
        if limit and len(result) >= limit:
            break
        if g['desc']:
            result.append(f"{g['title']}: {g['desc']}")
        else:
            result.append(g['title'])
    
    return result


def merge_string_lists(*lists: list[list]) -> list[str]:
    """
    Birden fazla listeyi birleştirir, tekrarları ilk geçtiği yerde bırakır.
    
    Args:
        lists: Birleştirilecek string listeleri
    
    Returns:
        Tekrarsız birleştirilmiş liste
    """
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
