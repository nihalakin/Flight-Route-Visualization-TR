"""
coupons tablosuna max_uses ve use_count sütunlarını ekler (yoksa).
Mevcut kuponlarda is_used=True olanlar use_count=1 yapılır.

Kullanım (proje kökünden): python -m scripts.migrate_coupon_max_uses
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from app.database import engine


def run():
    with engine.connect() as conn:
        # PostgreSQL / MySQL uyumlu: sütun var mı kontrol etmeden ekle (var ise hata verebilir)
        for stmt, desc in [
            (
                "ALTER TABLE coupons ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 1",
                "max_uses sütunu",
            ),
            (
                "ALTER TABLE coupons ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0",
                "use_count sütunu",
            ),
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
                print("Eklendi:", desc)
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print("Zaten var:", desc)
                else:
                    print("Hata (%s): %s" % (desc, e))
                conn.rollback()

        # Mevcut kuponlarda is_used=True ise use_count=1 yap
        try:
            result = conn.execute(
                text("UPDATE coupons SET use_count = 1 WHERE is_used = true")
            )
            conn.commit()
            print("Güncellendi: is_used=true olan kuponlarda use_count=1 yapıldı.")
        except Exception as e:
            print("Update hatası (use_count backfill):", e)
            conn.rollback()


if __name__ == "__main__":
    run()
