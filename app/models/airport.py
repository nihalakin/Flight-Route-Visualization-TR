from sqlalchemy import Column, Float, Integer, String

from app.database import Base


class Airport(Base):
    """
    Türkiye havalimanları tablosu.

    Not: Bu model, mevcut `airports` tablosundaki yaygın alanlara göre
    tanımlanmıştır. Sütun isimleri büyük oranda `airport.json` dosyasındaki
    verilerle uyumludur.
    """

    __tablename__ = "airports"

    id = Column(Integer, primary_key=True, index=True)

    city = Column(String, nullable=False)
    icao = Column(String(10), nullable=False, index=True)
    iata = Column(String(10), nullable=False, index=True)
    name = Column(String, nullable=False)

    type = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    region = Column(String, nullable=True)
    flights = Column(String, nullable=True)

