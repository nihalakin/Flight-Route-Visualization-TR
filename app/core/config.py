"""
Uygulama ayarları. .env proje kökünden yüklenir.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Proje kökü (Nodia/) - tek .env dosyası burada
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# Veritabanı (boşlukları temizle)
DATABASE_URL = (os.getenv("DATABASE_URL") or "postgresql://postgres:123456@localhost/nodia_db").strip()

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
