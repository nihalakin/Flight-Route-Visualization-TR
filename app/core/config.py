import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel


"""
Uygulama ayarları. .env proje kökünden yüklenir.
"""

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings(BaseModel):
    app_name: str = os.getenv("APP_NAME", "MyFastAPIApp")
    database_url: str = (os.getenv("DATABASE_URL") or "postgresql://postgres:123456@localhost/nodia_db").strip()
    smtp_host: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    email_from: str = os.getenv("EMAIL_FROM", "")
    frontend_reset_url: str = os.getenv(
        "FRONTEND_RESET_URL", "https://yourdomain.com/reset-password"
    )


settings = Settings()

# Veritabanı (SQLAlchemy ve legacy kod için)
DATABASE_URL = settings.database_url

# JWT / Auth (SECRET_KEY veya JWT_SECRET_KEY, ALGORITHM veya JWT_ALGORITHM)
SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET_KEY") or "supersecretkey"
ALGORITHM = os.getenv("ALGORITHM") or os.getenv("JWT_ALGORITHM") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# İlk çalıştırmada oluşturulacak tek admin (.env'den, boşluklar temizlenir)
ADMIN_EMAIL = (os.getenv("ADMIN_EMAIL") or "admin@nodia.com").strip()
ADMIN_PASSWORD = (os.getenv("ADMIN_PASSWORD") or "Admin123").strip()
ADMIN_FIRST_NAME = (os.getenv("ADMIN_FIRST_NAME") or "Super").strip()
ADMIN_LAST_NAME = (os.getenv("ADMIN_LAST_NAME") or "Admin").strip()

# Amadeus API
AMADEUS_API_KEY = os.getenv("AMADEUS_API_KEY", "")
AMADEUS_API_SECRET = os.getenv("AMADEUS_API_SECRET", "")

# OpenRouter (yorum analizi - Gemma 3 27B)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemma-3-27b-it")

