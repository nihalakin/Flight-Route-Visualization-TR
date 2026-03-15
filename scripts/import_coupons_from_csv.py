"""
sentetik_iade_biletleri_turkiye.csv dosyasındaki kupon verilerini veritabanındaki
coupons tablosuna bir kereye mahsus aktarır.

Kullanım (proje kökünden):
    python -m scripts.import_coupons_from_csv
"""

import csv
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal  # noqa: E402
from app.models import Coupon, Airline  # noqa: E402


CSV_PATH = ROOT / "data" / "sentetik_iade_biletleri_turkiye.csv"


def load_airline_lookup(db):
    """Airline.name'e göre basit bir lookup sözlüğü döner (lower-case)."""
    rows = db.query(Airline).all()
    return {a.name.lower(): a for a in rows}


def normalize_airline_name(name: str) -> str:
    """CSV'deki havayolu isimlerini normalize et (çok basit)."""
    name = (name or "").strip()
    mapping = {
        "türk hava yolları": "Turkish Airlines",
        "anadolujet": "AnadoluJet",
        "ajet": "AJet",
        "pegasus": "Pegasus Airlines",
        "sunexpress": "SunExpress",
    }
    key = name.lower()
    return mapping.get(key, name)


def import_coupons():
    if not CSV_PATH.exists():
        print(f"CSV dosyası bulunamadı: {CSV_PATH}")
        return

    db = SessionLocal()
    try:
        airline_lookup = load_airline_lookup(db)

        with CSV_PATH.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            imported = 0
            skipped = 0
            for row in reader:
                code = (row.get("pnr_kodu") or "").strip().upper()
                if not code:
                    skipped += 1
                    continue

                # Zaten varsa atla
                existing = db.query(Coupon).filter(Coupon.code == code).first()
                if existing:
                    skipped += 1
                    continue

                airline_name_raw = (row.get("havayolu") or "").strip()
                airline_name = normalize_airline_name(airline_name_raw)
                airline = airline_lookup.get(airline_name.lower())
                airline_id = airline.id if airline else None

                def parse_float(val: str | None) -> float | None:
                    if not val:
                        return None
                    try:
                        return float(val.replace(",", "."))
                    except Exception:
                        return None

                def parse_date(val: str | None) -> datetime.date | None:
                    if not val:
                        return None
                    try:
                        return datetime.strptime(val.strip(), "%Y-%m-%d").date()
                    except Exception:
                        return None

                coupon = Coupon(
                    code=code,
                    airline_name=airline_name or airline_name_raw,
                    airline_id=airline_id,
                    original_amount=parse_float(row.get("bilet_tutari_tl")),
                    refund_amount=parse_float(row.get("iade_edilen_tutar_tl")),
                    issue_date=parse_date(row.get("iade_tarihi")),
                    cancel_reason=(row.get("iptal_nedeni") or "").strip() or None,
                    expiry_date=parse_date(row.get("son_kullanim_tarihi")) or datetime.utcnow().date(),
                    is_active=True,
                    is_used=False,
                )
                db.add(coupon)
                imported += 1

            db.commit()
            print(f"Kupon aktarımı tamamlandı. Yeni eklenen kupon sayısı: {imported}, atlanan: {skipped}")
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"Hata: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import_coupons()

