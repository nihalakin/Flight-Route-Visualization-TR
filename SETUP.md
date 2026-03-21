# Nodia – Kurulum

## Gereksinimler
- Python 3.11+
- PostgreSQL

## 1. Bağımlılıklar
```bash
pip install -r requirements.txt
```

## 2. Ortam değişkenleri
Proje **kökünde** `.env` dosyası oluşturun:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/nodia_db
SECRET_KEY=supersecretkey
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# İlk çalıştırmada oluşturulacak tek admin (sadece admin yoksa)
ADMIN_EMAIL=admin@nodia.com
ADMIN_PASSWORD=Admin123
ADMIN_FIRST_NAME=Super
ADMIN_LAST_NAME=Admin

# Opsiyonel: Amadeus uçuş arama
AMADEUS_API_KEY=
AMADEUS_API_SECRET=
```

- Sistemde sadece **1 admin** olur; ilk çalıştırmada yoksa yukarıdaki bilgilerle oluşturulur.
- Register ile admin oluşturulamaz; `is_admin` kullanıcıdan alınmaz.
- Tüm ortam değişkenleri **proje kökündeki tek .env** dosyasında tutulur.

## 3. Veritabanı ve tablolar
PostgreSQL’de veritabanı yoksa oluşturun (örnek: `nodia_db`):

```sql
CREATE DATABASE nodia_db;
```

Tablolar uygulama ilk açıldığında oluşturulur. Tablolar yoksa veya bağlantı hatası aldıysanız, script ile oluşturabilirsiniz (proje kökünden):

```bash
python scripts/create_tables.py
```

## 4. Çalıştırma
```bash
# Seçenek 1: run.ps1 (Windows)
.\run.ps1

# Seçenek 2: uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

## 5. Adresler
- Uygulama: http://localhost:5000
- API dokümantasyonu: http://localhost:5000/docs
- ReDoc: http://localhost:5000/redoc
- Health: http://localhost:5000/api/health

## API uç noktaları
- `POST /api/register` – Kayıt (email, first_name, last_name, password; admin oluşturulamaz)
- `POST /api/login` – Giriş (form: username=email, password); JWT döner
- `GET /api/me` – Mevcut kullanıcı (Bearer token)
- `GET /api/admin/me` – Sadece admin (Bearer token)
- `GET /api/flights` – Uçuş arama (Amadeus)
- `GET /api/health` – Sağlık kontrolü

## Tablolar oluşmuyorsa
1. PostgreSQL’in çalıştığından ve `DATABASE_URL` içindeki veritabanının (örn. `nodia_db`) oluşturulduğundan emin olun.
2. `python scripts/create_tables.py` çalıştırın (proje kökünden).
3. Uygulamayı yeniden başlatın.
