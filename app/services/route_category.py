"""Rota kategorisi hesaplama servisi.

Kategori, hizmet kalitesine göre değil uçuşun rota tipine göre belirlenir.
Bu modül, ticket_details.departure_airport_code / arrival_airport_code alanlarından
otomatik olarak kategori üretmek için kullanılır.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional


class RouteCategory(str, Enum):
    """Uçuşun rota tipine göre kategorisi (coğrafi; hizmet kalitesi değil)."""

    DOMESTIC = "DOMESTIC"
    EUROPE = "EUROPE"
    MIDDLE_EAST = "MIDDLE_EAST"
    INTERNATIONAL = "INTERNATIONAL"
    INTERCONTINENTAL = "INTERCONTINENTAL"


# Basit ülke / kıta haritaları.
# Gerçek üretim senaryosunda bu yapı genişletilebilir veya ayrı bir tabloya taşınabilir.

TURKEY_COUNTRY_CODE = "TR"

EUROPE_COUNTRIES = {
    "AL",
    "AD",
    "AM",
    "AT",
    "AZ",
    "BA",
    "BE",
    "BG",
    "BY",
    "CH",
    "CY",
    "CZ",
    "DE",
    "DK",
    "EE",
    "ES",
    "FI",
    "FR",
    "GE",
    "GR",
    "HR",
    "HU",
    "IE",
    "IS",
    "IT",
    "KZ",
    "LI",
    "LT",
    "LU",
    "LV",
    "MC",
    "MD",
    "ME",
    "MK",
    "MT",
    "NL",
    "NO",
    "PL",
    "PT",
    "RO",
    "RS",
    "RU",
    "SE",
    "SI",
    "SK",
    "SM",
    "UA",
    "UK",
}

MIDDLE_EAST_COUNTRIES = {
    "AE",  # Birleşik Arap Emirlikleri
    "SA",  # Suudi Arabistan
    "QA",  # Katar
    "OM",
    "KW",
    "BH",
    "JO",
    "LB",
    "IQ",
    "IR",
    "IL",
    "YE",
    "SY",
}

CONTINENT_BY_COUNTRY = {
    # Avrupa
    **{c: "EUROPE" for c in EUROPE_COUNTRIES},
    # Orta Doğu (Asya tarafı)
    **{c: "ASIA" for c in MIDDLE_EAST_COUNTRIES},
    # Türkiye
    TURKEY_COUNTRY_CODE: "ASIA_EUROPE",
    # Örnek diğerleri
    "US": "NORTH_AMERICA",
    "CA": "NORTH_AMERICA",
    "BR": "SOUTH_AMERICA",
    "CN": "ASIA",
    "JP": "ASIA",
    "AU": "OCEANIA",
}


# Çok basit bir IATA -> ülke kodu haritası.
# Gerektikçe bu sözlük genişletilebilir veya DB tablosu ile değiştirilebilir.
IATA_TO_COUNTRY = {
    # Türkiye'deki başlıca havalimanları
    "IST": TURKEY_COUNTRY_CODE,
    "SAW": TURKEY_COUNTRY_CODE,
    "ESB": TURKEY_COUNTRY_CODE,
    "ADB": TURKEY_COUNTRY_CODE,
    "AYT": TURKEY_COUNTRY_CODE,
    "GZP": TURKEY_COUNTRY_CODE,
    "BJV": TURKEY_COUNTRY_CODE,
    "DLM": TURKEY_COUNTRY_CODE,
    "VAN": TURKEY_COUNTRY_CODE,
    # Örnek Avrupa
    "LHR": "UK",
    "LGW": "UK",
    "CDG": "FR",
    "AMS": "NL",
    "FRA": "DE",
    "MUC": "DE",
    "MAD": "ES",
    "BCN": "ES",
    "VIE": "AT",
    "ZRH": "CH",
    # Örnek Orta Doğu
    "DXB": "AE",
    "AUH": "AE",
    "DOH": "QA",
    "RUH": "SA",
    "JED": "SA",
    # Örnek diğer kıtalar
    "JFK": "US",
    "EWR": "US",
    "SFO": "US",
    "LAX": "US",
    "YYZ": "CA",
    "GRU": "BR",
    "PEK": "CN",
    "HND": "JP",
    "NRT": "JP",
    "SYD": "AU",
}


def get_country_by_airport_code(iata_code: Optional[str]) -> Optional[str]:
    """IATA havalimanı kodundan ülke kodunu döndürür (bilinmiyorsa None)."""
    if not iata_code:
        return None
    return IATA_TO_COUNTRY.get(iata_code.upper())


def calculate_route_category(
    departure_airport_code: Optional[str],
    arrival_airport_code: Optional[str],
) -> Optional[RouteCategory]:
    """Rota kategorisini otomatik hesapla.

    Kurallar:
    - departure_country == arrival_country → DOMESTIC
    - Türkiye → Avrupa ülkesi → EUROPE
    - Türkiye → Orta Doğu ülkesi → MIDDLE_EAST
    - Farklı kıtalar → INTERCONTINENTAL
    - Diğer uluslararası uçuşlar → INTERNATIONAL
    """

    if not departure_airport_code or not arrival_airport_code:
        return None

    dep_country = get_country_by_airport_code(departure_airport_code)
    arr_country = get_country_by_airport_code(arrival_airport_code)

    if not dep_country or not arr_country:
        return None

    # Aynı ülke → DOMESTIC
    if dep_country == arr_country:
        return RouteCategory.DOMESTIC

    # Türkiye -> Avrupa
    if dep_country == TURKEY_COUNTRY_CODE and arr_country in EUROPE_COUNTRIES:
        return RouteCategory.EUROPE

    # Türkiye -> Orta Doğu
    if dep_country == TURKEY_COUNTRY_CODE and arr_country in MIDDLE_EAST_COUNTRIES:
        return RouteCategory.MIDDLE_EAST

    # Farklı kıtalar → INTERCONTINENTAL
    dep_cont = CONTINENT_BY_COUNTRY.get(dep_country)
    arr_cont = CONTINENT_BY_COUNTRY.get(arr_country)
    if dep_cont and arr_cont and dep_cont != arr_cont:
        return RouteCategory.INTERCONTINENTAL

    # Diğer uluslararası uçuşlar
    return RouteCategory.INTERNATIONAL

