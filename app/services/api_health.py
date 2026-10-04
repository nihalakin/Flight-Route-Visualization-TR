"""
API health check service for monitoring external API connections.
"""
import httpx
from sqlalchemy import text
from app.core.config import (
    AMADEUS_API_KEY,
    AMADEUS_API_SECRET,
    OPENROUTER_API_KEY,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
)
from app.database import engine


async def check_amadeus_api() -> dict:
    """Check Amadeus API connection."""
    if not AMADEUS_API_KEY or not AMADEUS_API_SECRET:
        return {
            "name": "Amadeus API",
            "status": "error",
            "message": "API anahtarları yapılandırılmamış",
            "connected": False,
        }
    
    try:
        token_url = "https://test.api.amadeus.com/v1/security/oauth2/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": AMADEUS_API_KEY,
            "client_secret": AMADEUS_API_SECRET,
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(token_url, data=data)
        
        if response.status_code == 200:
            return {
                "name": "Amadeus API",
                "status": "success",
                "message": "Bağlantı başarılı",
                "connected": True,
            }
        else:
            return {
                "name": "Amadeus API",
                "status": "error",
                "message": f"API hatası: {response.status_code}",
                "connected": False,
            }
    except Exception as e:
        return {
            "name": "Amadeus API",
            "status": "error",
            "message": f"Bağlantı hatası: {str(e)}",
            "connected": False,
        }


async def check_openrouter_api() -> dict:
    """Check OpenRouter API connection."""
    if not OPENROUTER_API_KEY:
        return {
            "name": "OpenRouter API",
            "status": "error",
            "message": "API anahtarı yapılandırılmamış",
            "connected": False,
        }
    
    try:
        url = "https://openrouter.ai/api/v1/models"
        headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}"}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
        
        if response.status_code == 200:
            return {
                "name": "OpenRouter API",
                "status": "success",
                "message": "Bağlantı başarılı",
                "connected": True,
            }
        else:
            return {
                "name": "OpenRouter API",
                "status": "error",
                "message": f"API hatası: {response.status_code}",
                "connected": False,
            }
    except Exception as e:
        return {
            "name": "OpenRouter API",
            "status": "error",
            "message": f"Bağlantı hatası: {str(e)}",
            "connected": False,
        }


def check_database() -> dict:
    """Check database connection."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "name": "Veritabanı",
            "status": "success",
            "message": "Bağlantı başarılı",
            "connected": True,
        }
    except Exception as e:
        return {
            "name": "Veritabanı",
            "status": "error",
            "message": f"Bağlantı hatası: {str(e)}",
            "connected": False,
        }


def check_smtp() -> dict:
    """Check SMTP connection."""
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        return {
            "name": "SMTP (E-posta)",
            "status": "error",
            "message": "SMTP yapılandırılmamış",
            "connected": False,
        }
    
    try:
        import smtplib
        from email.mime.text import MIMEText
        
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.quit()
        
        return {
            "name": "SMTP (E-posta)",
            "status": "success",
            "message": "Bağlantı başarılı",
            "connected": True,
        }
    except Exception as e:
        return {
            "name": "SMTP (E-posta)",
            "status": "error",
            "message": f"Bağlantı hatası: {str(e)}",
            "connected": False,
        }


async def get_all_api_statuses() -> dict:
    """Get status of all external APIs and services."""
    amadeus_status = await check_amadeus_api()
    openrouter_status = await check_openrouter_api()
    database_status = check_database()
    smtp_status = check_smtp()
    
    return {
        "amadeus": amadeus_status,
        "openrouter": openrouter_status,
        "database": database_status,
        "smtp": smtp_status,
    }
