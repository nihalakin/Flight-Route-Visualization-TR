import csv
import sys
from pathlib import Path

# Proje kökünü sys.path'e ekle ki "app" modülü bulunabilsin
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.models import (
    AnnualAirTraffic,
    AnnualCargoTraffic,
    AnnualPassengerTraffic,
    AnnualFreightTraffic,
)


DATA_DIR = ROOT / "data" / "annual_statistics"


def load_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows: list[dict] = []
        for row in reader:
            rows.append(row)
        return rows


def to_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    # Türkçe ondalık ayırıcılarını da destekle
    value = value.replace(".", "").replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return None


def import_air_traffic(db):
    path = DATA_DIR / "air_traffic.csv"
    if not path.exists():
        print(f"[air] CSV bulunamadı: {path}")
        return
    rows = load_csv(path)
    for row in rows:
        yil = int(row["yil"])
        obj = db.query(AnnualAirTraffic).filter_by(yil=yil).first()
        if not obj:
            obj = AnnualAirTraffic(yil=yil)
            db.add(obj)
        obj.tüm_uçak_overflight_dahil = to_float(row.get("tüm_uçak_overflight_dahil")) or 0
        obj.uçak_trafiği = to_float(row.get("uçak_trafiği")) or 0
        obj.iç_hat = to_float(row.get("iç_hat")) or 0
        obj.dış_hat = to_float(row.get("dış_hat")) or 0
        obj.overflight_uçak_trafiği = to_float(row.get("overflight_uçak_trafiği")) or 0
    db.commit()
    print(f"[air] {len(rows)} satır içe aktarıldı.")


def import_cargo_traffic(db):
    path = DATA_DIR / "cargo_traffic.csv"
    if not path.exists():
        print(f"[cargo] CSV bulunamadı: {path}")
        return
    rows = load_csv(path)
    for row in rows:
        yil = int(row["yil"])
        obj = db.query(AnnualCargoTraffic).filter_by(yil=yil).first()
        if not obj:
            obj = AnnualCargoTraffic(yil=yil)
            db.add(obj)
        obj.kargo_trafiği_ton = to_float(row.get("kargo_trafiği_ton")) or 0
        obj.iç_hat_kargo_ton = to_float(row.get("iç_hat_kargo_ton")) or 0
        obj.dış_hat_kargo_ton = to_float(row.get("dış_hat_kargo_ton")) or 0
    db.commit()
    print(f"[cargo] {len(rows)} satır içe aktarıldı.")


def import_passenger_traffic(db):
    path = DATA_DIR / "passenger_traffic.csv"
    if not path.exists():
        print(f"[passenger] CSV bulunamadı: {path}")
        return
    rows = load_csv(path)
    for row in rows:
        yil = int(row["yil"])
        obj = db.query(AnnualPassengerTraffic).filter_by(yil=yil).first()
        if not obj:
            obj = AnnualPassengerTraffic(yil=yil)
            db.add(obj)
        obj.yolcu_trafiği_transit_dahil = to_float(row.get("yolcu_trafiği_transit_dahil")) or 0
        obj.yolcu_trafiği = to_float(row.get("yolcu_trafiği")) or 0
        obj.iç_hat = to_float(row.get("iç_hat")) or 0
        obj.dış_hat = to_float(row.get("dış_hat")) or 0
        obj.direkt_transit = to_float(row.get("direkt_transit")) or 0
    db.commit()
    print(f"[passenger] {len(rows)} satır içe aktarıldı.")


def import_freight_traffic(db):
    path = DATA_DIR / "freight_traffic.csv"
    if not path.exists():
        print(f"[freight] CSV bulunamadı: {path}")
        return
    rows = load_csv(path)
    for row in rows:
        yil = int(row["yil"])
        obj = db.query(AnnualFreightTraffic).filter_by(yil=yil).first()
        if not obj:
            obj = AnnualFreightTraffic(yil=yil)
            db.add(obj)
        obj.yük_trafiği_ton = to_float(row.get("yük_trafiği_ton")) or 0
        obj.iç_hat_ton = to_float(row.get("iç_hat_ton")) or 0
        obj.dış_hat_ton = to_float(row.get("dış_hat_ton")) or 0
    db.commit()
    print(f"[freight] {len(rows)} satır içe aktarıldı.")


def main():
    db = SessionLocal()
    try:
        import_air_traffic(db)
        import_cargo_traffic(db)
        import_passenger_traffic(db)
        import_freight_traffic(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()

