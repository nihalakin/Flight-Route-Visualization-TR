from fastapi import FastAPI

from app.db.database import Base, engine
from app.routers import auth


Base.metadata.create_all(bind=engine)

app = FastAPI(title="MyFastAPIApp")

app.include_router(auth.router)


@app.get("/health")
def health():
    return {"status": "ok"}

"""
Nodia FastAPI uygulaması.
Auth, uçuş arama ve statik sayfalar tek uygulamada.
"""
import sys
from pathlib import Path

# Proje kökünü path'e ekle (nereden çalıştırılırsa çalıştırılsın app modülü bulunsun)
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import logging
import os

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.templating import Jinja2Templates
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import (
    ADMIN_EMAIL,
    ADMIN_FIRST_NAME,
    ADMIN_LAST_NAME,
    ADMIN_PASSWORD,
)
from app.database import SessionLocal, engine, Base
from app.models import User, Ticket, TicketDetail, Airline, UserReview, Airport, PasswordReset
from app.routes import auth, flights, tickets, admin, reviews, public_reviews, coupons, airports_public

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)
scheduler: AsyncIOScheduler | None = None

def ensure_username_column_and_fill():
    """
    Kullanıcı tablosunda username alanını ve benzersiz değerleri garanti et.
    - SQLite üzerinde PRAGMA ile sütun kontrolü yapılır, yoksa ALTER TABLE ile eklenir.
    - username'i olmayan mevcut kullanıcılar için email'den türetilen benzersiz username atanır.
    """
    from sqlalchemy import text
    import re

    try:
        # Sadece SQLite için PRAGMA kullan (diğer veritabanlarında şimdilik atla)
        if engine.dialect.name != "sqlite":
            logger.info("Username column migration skipped (dialect=%s)", engine.dialect.name)
            return

        with engine.connect() as conn:
            rows = conn.execute(text("PRAGMA table_info('users')")).mappings().all()
            has_username = any(r.get("name") == "username" for r in rows)
            if not has_username:
                logger.info("Adding username column to users table")
                conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR"))

        db = SessionLocal()
        try:
            taken_usernames = {
                u.username
                for u in db.query(User).filter(User.username.isnot(None))
            }
            users_without_username = db.query(User).filter(User.username.is_(None)).all()
            for u in users_without_username:
                base = (u.email or "").split("@")[0].split("+")[0] or f"user{u.id}"
                base = re.sub(r"[^a-zA-Z0-9_.-]", "", base) or f"user{u.id}"
                candidate = base
                idx = 1
                while candidate in taken_usernames:
                    candidate = f"{base}{idx}"
                    idx += 1
                u.username = candidate
                taken_usernames.add(candidate)
            if users_without_username:
                db.commit()
                logger.info("Backfilled usernames for %d users", len(users_without_username))
        finally:
            db.close()
    except Exception as e:
        logger.warning("Username column/backfill step failed: %s", e)


def ensure_ticket_detail_airline_column():
    """
    ticket_details tablosuna airline_id kolonunu ekle (varsa dokunma).
    Mevcut bilet verileri korunur; yeni kolon NULL olarak eklenir.
    """
    from sqlalchemy import text

    try:
        dialect = engine.dialect.name

        # SQLite: PRAGMA ile kontrol et, yoksa normal ALTER TABLE ekle
        if dialect == "sqlite":
            with engine.begin() as conn:
                rows = conn.execute(text("PRAGMA table_info('ticket_details')")).mappings().all()
                has_airline_id = any(r.get("name") == "airline_id" for r in rows)
                if not has_airline_id:
                    logger.info("Adding airline_id column to ticket_details table (sqlite)")
                    conn.execute(
                        text(
                            "ALTER TABLE ticket_details "
                            "ADD COLUMN airline_id INTEGER REFERENCES airlines(id)"
                        )
                    )
            return

        # PostgreSQL: IF NOT EXISTS ile idempotent DDL
        if dialect in {"postgresql", "postgres"}:
            with engine.begin() as conn:
                logger.info("Ensuring airline_id column on ticket_details (postgres)")
                conn.execute(
                    text(
                        "ALTER TABLE ticket_details "
                        "ADD COLUMN IF NOT EXISTS airline_id INTEGER REFERENCES airlines(id)"
                    )
                )
            return

        logger.info(
            "ticket_details.airline_id migration skipped (unsupported dialect=%s)",
            dialect,
        )
    except Exception as e:
        logger.warning("ticket_details.airline_id migration step failed: %s", e)


def ensure_ticket_detail_datetime_columns():
    """
    ticket_details tablosuna departure_datetime ve arrival_datetime kolonlarını ekle
    veya eski departure_date/arrival_date kolonlarını yeniden adlandır.
    Mevcut veriler korunur; yeni kolonlar NULL olarak eklenir.
    """
    from sqlalchemy import text

    try:
        dialect = engine.dialect.name

        if dialect == "sqlite":
            with engine.begin() as conn:
                rows = conn.execute(text("PRAGMA table_info('ticket_details')")).mappings().all()
                column_names = {r.get("name") for r in rows}

                # Eski isimleri yeni isimlere taşı
                if "departure_date" in column_names and "departure_datetime" not in column_names:
                    logger.info("Renaming departure_date to departure_datetime (sqlite)")
                    conn.execute(
                        text("ALTER TABLE ticket_details RENAME COLUMN departure_date TO departure_datetime")
                    )
                    column_names.discard("departure_date")
                    column_names.add("departure_datetime")
                if "arrival_date" in column_names and "arrival_datetime" not in column_names:
                    logger.info("Renaming arrival_date to arrival_datetime (sqlite)")
                    conn.execute(
                        text("ALTER TABLE ticket_details RENAME COLUMN arrival_date TO arrival_datetime")
                    )
                    column_names.discard("arrival_date")
                    column_names.add("arrival_datetime")

                # Eksikse yeni kolon ekle
                if "departure_datetime" not in column_names:
                    logger.info("Adding departure_datetime column to ticket_details table (sqlite)")
                    conn.execute(
                        text("ALTER TABLE ticket_details ADD COLUMN departure_datetime TIMESTAMP")
                    )
                if "arrival_datetime" not in column_names:
                    logger.info("Adding arrival_datetime column to ticket_details table (sqlite)")
                    conn.execute(
                        text("ALTER TABLE ticket_details ADD COLUMN arrival_datetime TIMESTAMP")
                    )
            return

        if dialect in {"postgresql", "postgres"}:
            with engine.begin() as conn:
                logger.info("Ensuring departure_datetime/arrival_datetime columns on ticket_details (postgres)")

                # Eski kolon adlarını kontrol et
                rows = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'ticket_details'
                          AND column_name IN ('departure_date', 'arrival_date',
                                              'departure_datetime', 'arrival_datetime')
                        """
                    )
                ).fetchall()
                existing = {r[0] for r in rows}

                # departure_date -> departure_datetime
                if "departure_date" in existing and "departure_datetime" not in existing:
                    logger.info("Renaming departure_date to departure_datetime (postgres)")
                    conn.execute(
                        text("ALTER TABLE ticket_details RENAME COLUMN departure_date TO departure_datetime")
                    )
                    existing.discard("departure_date")
                    existing.add("departure_datetime")

                # arrival_date -> arrival_datetime
                if "arrival_date" in existing and "arrival_datetime" not in existing:
                    logger.info("Renaming arrival_date to arrival_datetime (postgres)")
                    conn.execute(
                        text("ALTER TABLE ticket_details RENAME COLUMN arrival_date TO arrival_datetime")
                    )
                    existing.discard("arrival_date")
                    existing.add("arrival_datetime")

                # Eksikse yeni kolonu ekle
                conn.execute(
                    text(
                        "ALTER TABLE ticket_details "
                        "ADD COLUMN IF NOT EXISTS departure_datetime TIMESTAMP"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE ticket_details "
                        "ADD COLUMN IF NOT EXISTS arrival_datetime TIMESTAMP"
                    )
                )
            return

        logger.info(
            "ticket_details datetime columns migration skipped (unsupported dialect=%s)",
            dialect,
        )
    except Exception as e:
        logger.warning("ticket_details datetime columns migration step failed: %s", e)


def drop_ticket_detail_legacy_time_columns():
    """
    ticket_details tablosundan departure_time ve arrival_time kolonlarını kaldır.
    Artık departure_date / arrival_date kullanılıyor.
    """
    from sqlalchemy import text

    try:
        dialect = engine.dialect.name

        if dialect in {"postgresql", "postgres"}:
            with engine.begin() as conn:
                logger.info("Dropping legacy time columns from ticket_details (postgres)")
                conn.execute(
                    text(
                        "ALTER TABLE ticket_details "
                        "DROP COLUMN IF EXISTS departure_time, "
                        "DROP COLUMN IF EXISTS arrival_time"
                    )
                )
            return

        if dialect == "sqlite":
            # Modern SQLite sürümlerinde DROP COLUMN desteklenir; hata olursa sadece logla.
            try:
                with engine.begin() as conn:
                    logger.info("Dropping legacy time columns from ticket_details (sqlite)")
                    conn.execute(text("ALTER TABLE ticket_details DROP COLUMN departure_time"))
                    conn.execute(text("ALTER TABLE ticket_details DROP COLUMN arrival_time"))
                return
            except Exception as inner:
                logger.warning("SQLite DROP COLUMN failed (leaving legacy columns): %s", inner)
                return

        logger.info(
            "ticket_details legacy time columns drop skipped (unsupported dialect=%s)",
            dialect,
        )
    except Exception as e:
        logger.warning("ticket_details legacy time columns drop step failed: %s", e)


def ensure_user_contribution_count_column():
    """
    users tablosuna contribution_count kolonunu ekler (varsa dokunma).
    Varsayılan değer 0 olarak ayarlanır.
    """
    from sqlalchemy import text

    try:
        dialect = engine.dialect.name

        if dialect == "sqlite":
            with engine.begin() as conn:
                rows = conn.execute(text("PRAGMA table_info('users')")).mappings().all()
                has_column = any(r.get("name") == "contribution_count" for r in rows)
                if not has_column:
                    logger.info("Adding contribution_count column to users table (sqlite)")
                    conn.execute(
                        text(
                            "ALTER TABLE users "
                            "ADD COLUMN contribution_count INTEGER NOT NULL DEFAULT 0"
                        )
                    )
            return

        if dialect in {"postgresql", "postgres"}:
            with engine.begin() as conn:
                logger.info("Ensuring contribution_count column on users (postgres)")
                conn.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN IF NOT EXISTS contribution_count INTEGER NOT NULL DEFAULT 0"
                    )
                )
            return

        logger.info(
            "users.contribution_count migration skipped (unsupported dialect=%s)",
            dialect,
        )
    except Exception as e:
        logger.warning("users.contribution_count migration step failed: %s", e)


def ensure_ticket_detail_route_category_column():
    """
    ticket_details tablosuna route_category kolonunu ekler (varsa dokunma).
    Basit bir VARCHAR/TEXT kolon olarak eklenir; SQLAlchemy Enum ile çalışır.
    """
    from sqlalchemy import text

    try:
        dialect = engine.dialect.name

        if dialect == "sqlite":
            with engine.begin() as conn:
                rows = conn.execute(text("PRAGMA table_info('ticket_details')")).mappings().all()
                has_column = any(r.get("name") == "route_category" for r in rows)
                if not has_column:
                    logger.info("Adding route_category column to ticket_details table (sqlite)")
                    conn.execute(
                        text(
                            "ALTER TABLE ticket_details "
                            "ADD COLUMN route_category VARCHAR(32)"
                        )
                    )
            return

        if dialect in {"postgresql", "postgres"}:
            with engine.begin() as conn:
                logger.info("Ensuring route_category column on ticket_details (postgres)")
                conn.execute(
                    text(
                        "ALTER TABLE ticket_details "
                        "ADD COLUMN IF NOT EXISTS route_category VARCHAR(32)"
                    )
                )
            return

        logger.info(
            "ticket_details.route_category migration skipped (unsupported dialect=%s)",
            dialect,
        )
    except Exception as e:
        logger.warning("ticket_details.route_category migration step failed: %s", e)

# Veritabanı tabloları
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
except Exception as e:
    logger.error("Failed to create database tables: %s", e)


def ensure_single_admin():
    """
    Uygulama ilk çalıştığında admin yoksa .env'deki bilgilerle tek admin oluştur.
    Zaten admin varsa hiçbir şey yapma. bcrypt doğrudan kullanılır (passlib/bcrypt sürüm uyumsuzluğunu önlemek için).
    """
    import bcrypt
    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(User.is_admin.is_(True)).first()
        if admin_exists:
            logger.info("Admin already exists, skipping creation")
            return
        pwd = ((ADMIN_PASSWORD or "Admin123").strip())[:72]
        hashed = bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        # Admin için benzersiz bir username oluştur
        base_username = (ADMIN_EMAIL or "admin@nodia.com").split("@")[0] or "admin"
        base_username = base_username.strip() or "admin"
        username_candidate = base_username
        counter = 1
        while db.query(User).filter(User.username == username_candidate).first():
            username_candidate = f"{base_username}{counter}"
            counter += 1

        admin = User(
            username=username_candidate,
            email=(ADMIN_EMAIL or "admin@nodia.com").strip(),
            first_name=(ADMIN_FIRST_NAME or "Super").strip(),
            last_name=(ADMIN_LAST_NAME or "Admin").strip(),
            hashed_password=hashed,
            is_active=True,
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Created single admin: %s", admin.email)
    except Exception as e:
        db.rollback()
        logger.error("Failed to create admin: %s", e)
        raise
    finally:
        db.close()


def ensure_default_airlines():
    """
    Sistem başlangıcında temel havayolu şirketlerini seed et.
    Kodlar (IATA/ICAO) benzersizdir; var olan kayıtlar tekrar eklenmez.
    """
    default_rows = [
        {"name": "AJet", "iata": "VF", "icao": "AJT", "country": "Türkiye", "is_active": True},
        {"name": "Turkish Airlines", "iata": "TK", "icao": "THY", "country": "Türkiye", "is_active": True},
        {"name": "Pegasus Airlines", "iata": "PC", "icao": "PGT", "country": "Türkiye", "is_active": True},
        {"name": "SunExpress", "iata": "XQ", "icao": "SXS", "country": "Türkiye", "is_active": True},
    ]

    db = SessionLocal()
    try:
        for row in default_rows:
            exists = (
                db.query(Airline)
                .filter(
                    (Airline.iata_code == row["iata"])
                    | (Airline.icao_code == row["icao"])
                )
                .first()
            )
            if exists:
                continue
            airline = Airline(
                name=row["name"],
                iata_code=row["iata"],
                icao_code=row["icao"],
                country=row["country"],
                is_active=row["is_active"],
            )
            db.add(airline)
        db.commit()
        logger.info("Default airlines ensured")
    except Exception as e:
        db.rollback()
        logger.warning("Failed to ensure default airlines: %s", e)
    finally:
        db.close()


def ensure_default_airports():
    """
    Sistem başlangıcında data/airport.json içindeki havalimanı verilerini
    airports tablosuna seed eder.

    - IATA kodu benzersiz kabul edilir; aynı IATA varsa kayıt güncellenmez.
    - Dosya yoksa veya okunamazsa sadece uyarı loglanır.
    """
    import json

    data_path = _ROOT / "data" / "airport.json"
    if not data_path.exists():
        logger.warning("airport.json not found at %s, skipping airport seed", data_path)
        return

    try:
        with data_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    except Exception as e:
        logger.warning("Failed to read airport.json: %s", e)
        return

    airports_json = payload.get("airports") if isinstance(payload, dict) else None
    if not airports_json or not isinstance(airports_json, list):
        logger.warning("airport.json has unexpected format, 'airports' list missing")
        return

    db = SessionLocal()
    try:
        for row in airports_json:
            iata = (row.get("iata") or "").strip().upper()
            icao = (row.get("icao") or "").strip().upper()
            name = (row.get("name") or "").strip()
            city = (row.get("city") or "").strip()
            if not iata or not icao or not name or not city:
                continue

            existing = db.query(Airport).filter(Airport.iata == iata).first()
            if existing:
                continue

            airport = Airport(
                name=name,
                city=city,
                iata=iata,
                icao=icao,
                type=(row.get("type") or "").strip() or None,
                year=row.get("year"),
                lat=row.get("lat"),
                lon=row.get("lon"),
                region=(row.get("region") or "").strip() or None,
                flights=(row.get("flights") or "").strip() or None,
            )
            db.add(airport)
        db.commit()
        logger.info("Default airports ensured from airport.json")
    except Exception as e:
        db.rollback()
        logger.warning("Failed to ensure default airports: %s", e)
    finally:
        db.close()


def cleanup_inactive_password_resets():
    """
    is_active = False olan password_resets kayıtlarını temizler.
    Her gün saat 06:00'da APScheduler ile çalıştırılır.
    """
    db = SessionLocal()
    try:
        deleted = (
            db.query(PasswordReset)
            .filter(PasswordReset.is_active.is_(False))
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted:
            logger.info("Cleaned up %d inactive password reset records", deleted)
    except Exception as e:
        db.rollback()
        logger.warning("Failed to cleanup password_resets: %s", e)
    finally:
        db.close()


def ensure_password_reset_is_active_column():
    """
    password_resets tablosuna is_active kolonunu ekler (varsa dokunma).
    Varsayılan değer True (aktif) olur.
    """
    from sqlalchemy import text

    try:
        dialect = engine.dialect.name

        if dialect == "sqlite":
            with engine.begin() as conn:
                rows = conn.execute(text("PRAGMA table_info('password_resets')")).mappings().all()
                has_column = any(r.get("name") == "is_active" for r in rows)
                if not has_column:
                    logger.info("Adding is_active column to password_resets table (sqlite)")
                    conn.execute(
                        text(
                            "ALTER TABLE password_resets "
                            "ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
                        )
                    )
            return

        if dialect in {"postgresql", "postgres"}:
            with engine.begin() as conn:
                logger.info("Ensuring is_active column on password_resets (postgres)")
                conn.execute(
                    text(
                        "ALTER TABLE password_resets "
                        "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"
                    )
                )
            return

        logger.info(
            "password_resets.is_active migration skipped (unsupported dialect=%s)",
            dialect,
        )
    except Exception as e:
        logger.warning("password_resets.is_active migration step failed: %s", e)

app = FastAPI(
    title="Nodia",
    description="Uçuş arama ve kullanıcı kimlik doğrulama API",
    version="1.0.0",
)


@app.on_event("startup")
def on_startup():
    """Startup: admin yoksa .env'den tek admin oluştur. DB yoksa uygulama yine de ayağa kalkar.
    Ayrıca password_resets cleanup job'unu zamanlar.
    """
    global scheduler
    try:
        ensure_username_column_and_fill()
        ensure_user_contribution_count_column()
        ensure_single_admin()
        ensure_default_airlines()
        ensure_default_airports()
        ensure_ticket_detail_airline_column()
        ensure_ticket_detail_datetime_columns()
        drop_ticket_detail_legacy_time_columns()
        ensure_ticket_detail_route_category_column()
        ensure_password_reset_is_active_column()
    except Exception as e:
        logger.warning("Startup admin check skipped (veritabanı bağlantısı yok veya hata): %s", e)

    try:
        scheduler = AsyncIOScheduler(timezone="UTC")
        scheduler.add_job(
            cleanup_inactive_password_resets,
            "cron",
            hour=6,
            minute=0,
        )
        scheduler.start()
        logger.info("APScheduler started for password_reset cleanup (06:00 UTC).")
    except Exception as e:
        logger.warning("Failed to start APScheduler: %s", e)


@app.on_event("shutdown")
def on_shutdown():
    """Uygulama kapanırken scheduler'ı güvenli şekilde durdur."""
    global scheduler
    if scheduler is not None:
        try:
            scheduler.shutdown()
            logger.info("APScheduler shutdown successfully.")
        except Exception as e:
            logger.warning("Failed to shutdown APScheduler: %s", e)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Proje kökü
ROOT_DIR = Path(__file__).resolve().parent.parent
if not (ROOT_DIR / "index.html").exists() and (Path.cwd() / "index.html").exists():
    ROOT_DIR = Path.cwd()

if os.path.exists(ROOT_DIR / "static"):
    app.mount("/static", StaticFiles(directory=str(ROOT_DIR / "static")), name="static")

templates = Jinja2Templates(directory="templates")

# Partials (navbar, footer) – frontend fetch için
@app.get("/partials/navbar.html", response_class=HTMLResponse)
async def partial_navbar(request: Request):
    return templates.TemplateResponse("partials/navbar.html", {"request": request})

@app.get("/partials/footer.html", response_class=HTMLResponse)
async def partial_footer(request: Request):
    return templates.TemplateResponse("partials/footer.html", {"request": request})

# API router'ları: /api/auth/*, /api/flights, /api/tickets, /api/admin/*, /api/reviews, /api/public/*, /api/coupons/*
app.include_router(auth.router, prefix="/api")
app.include_router(flights.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(public_reviews.router, prefix="/api")
app.include_router(coupons.router, prefix="/api")
app.include_router(airports_public.router, prefix="/api")

# Health: tek endpoint, veritabanı varsa kontrol et
@app.get("/api/health")
async def health_check():
    """Sağlık kontrolü."""
    try:
        from sqlalchemy import text
        from app.database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "message": "All systems operational",
        }
    except Exception as e:
        logger.error("Health check failed: %s", e)
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
        }

# Ana sayfa: uçuş ağı uygulaması (index.html)
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Varsayılan ana sayfa - index.html."""
    index_path = ROOT_DIR / "index.html"
    if not index_path.exists():
        logger.warning("index.html not found at %s (ROOT_DIR=%s, cwd=%s)", index_path, ROOT_DIR, Path.cwd())
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(
            f"index.html bulunamadı. ROOT_DIR={ROOT_DIR}, cwd={Path.cwd()}",
            status_code=404,
        )
    return FileResponse(index_path)

# Auth sayfaları
@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(request: Request):
    """Şifre sıfırlama formu (emaildeki linkten gelinir)."""
    return templates.TemplateResponse("reset-password.html", {"request": request})


@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})


@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard_page(request: Request):
    """
    Admin dashboard sayfası.
    Admin kontrolü frontend'de /api/admin/me ile yapılır (token üzerinden).
    """
    return templates.TemplateResponse("admin/dashboard.html", {"request": request})


@app.get("/admin/users", response_class=HTMLResponse)
async def admin_users_page(request: Request):
    """Admin kullanıcı yönetimi sayfası."""
    return templates.TemplateResponse("admin/users.html", {"request": request})


@app.get("/admin/airports", response_class=HTMLResponse)
async def admin_airports_page(request: Request):
    """Admin havalimanları yönetimi sayfası."""
    return templates.TemplateResponse("admin/airports.html", {"request": request})


@app.get("/admin/reviews", response_class=HTMLResponse)
async def admin_reviews_page(request: Request):
    """Admin yorum yönetimi sayfası."""
    return templates.TemplateResponse("admin/reviews.html", {"request": request})


@app.get("/admin/coupons", response_class=HTMLResponse)
async def admin_coupons_page(request: Request):
    """Admin kupon yönetimi sayfası."""
    return templates.TemplateResponse("admin/coupons.html", {"request": request})


@app.get("/ticket-preview", response_class=HTMLResponse)
async def ticket_preview_page(request: Request):
    """Bilet önizleme sayfası (yeni sekmede açılır, token ile API'den bilet HTML'i alır)."""
    return templates.TemplateResponse("ticket-preview.html", {"request": request})


@app.get("/info")
async def api_info():
    """API bilgisi (docs, health linkleri)."""
    return {
        "message": "Nodia API",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/api/health",
    }

# Statik dosyalar: HTML sayfaları, css, js (create-route.html, airports.html vb.)
app.mount("/", StaticFiles(directory=str(ROOT_DIR), html=True), name="root_static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
