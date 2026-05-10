"""
Veritabanı tablolarını oluşturur. Veritabanı (örn. nodia_db) zaten var olmalı.
Kullanım (proje kökünden): python scripts/create_tables.py
"""
import sys
from pathlib import Path

# Proje kökünü path'e ekle
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Config ve engine yüklensin (app.core.config proje kökündeki .env okur)
from app.database import engine, Base
from app.models import User, Ticket, TicketDetail, Airline, UserReview, Coupon  # noqa: F401

if __name__ == "__main__":
    print("Tablolar oluşturuluyor...")
    Base.metadata.create_all(bind=engine)
    print(
        "Tamamlandı. users, tickets, ticket_details, airlines, user_reviews, coupons tabloları oluşturuldu."
    )
