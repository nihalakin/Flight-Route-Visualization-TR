import csv
import sys
from datetime import datetime
from pathlib import Path

# Proje kökünü sys.path'e ekle ki "app" modülü bulunabilsin
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.models import AirlineDatasetReview


DATA_PATH = ROOT / "assets" / "data" / "airlines_reviews.csv"


TR_MONTHS = {
    "Ocak": 1,
    "Şubat": 2,
    "Mart": 3,
    "Nisan": 4,
    "Mayıs": 5,
    "Haziran": 6,
    "Temmuz": 7,
    "Ağustos": 8,
    "Eylül": 9,
    "Ekim": 10,
    "Kasım": 11,
    "Aralık": 12,
}


def parse_tr_date(date_str: str | None) -> datetime | None:
    """
    "22 Şubat 2026" gibi tarihleri datetime'a çevirir.
    Hatalı formatta ise None döner.
    """
    if not date_str:
        return None
    date_str = date_str.strip()
    if not date_str:
        return None
    parts = date_str.split()
    if len(parts) != 3:
        return None
    try:
        day = int(parts[0])
        month = TR_MONTHS.get(parts[1])
        year = int(parts[2])
        if not month:
            return None
        return datetime(year, month, day)
    except Exception:
        return None


def main():
    if not DATA_PATH.exists():
        print(f"CSV bulunamadı: {DATA_PATH}")
        return

    db = SessionLocal()
    try:
        with DATA_PATH.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            inserted = 0
            for row in reader:
                try:
                    ext_id_raw = row.get("Yorum No") or ""
                    external_id = int(ext_id_raw) if ext_id_raw.strip() else None
                except ValueError:
                    external_id = None

                airline_name = (row.get("Havayolu") or "").strip() or "Bilinmiyor"
                content = (row.get("Yorum İçeriği (Tam Metin - Türkçe)") or "").strip()
                if not content:
                    continue

                q = db.query(AirlineDatasetReview).filter(
                    AirlineDatasetReview.airline_name == airline_name,
                    AirlineDatasetReview.content == content,
                )
                if external_id is not None:
                    q = q.filter(AirlineDatasetReview.external_id == external_id)
                existing = q.first()
                if existing:
                    continue

                rating_raw = row.get("Puan") or ""
                try:
                    rating = int(rating_raw)
                except ValueError:
                    rating = 0
                rating = max(1, min(5, rating or 0))

                review = AirlineDatasetReview(
                    external_id=external_id,
                    airline_name=airline_name,
                    user_name=(row.get("Kullanıcı Adı") or "").strip() or None,
                    contribution_count=int(row.get("Katkı Sayısı") or 0) or None,
                    rating=rating,
                    title=(row.get("Başlık / Ana Tema") or "").strip() or None,
                    route=(row.get("Rota") or "").strip() or None,
                    category=(row.get("Kategori") or "").strip() or None,
                    travel_date_raw=(row.get("Seyahat Tarihi") or "").strip() or None,
                    review_date=parse_tr_date(row.get("Yorum Tarihi")),
                    content=content,
                    sentiment_label=(row.get("Olumlu/Olumsuz/Nötr") or "").strip() or None,
                    is_processed=False,
                )
                db.add(review)
                inserted += 1

            db.commit()
            print(f"{inserted} satır airline_dataset_reviews tablosuna eklendi.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

