from sqlalchemy import Column, Float, Integer

from app.database import Base


class AnnualAirTraffic(Base):
    __tablename__ = "annual_air_traffic"

    yil = Column(Integer, primary_key=True, index=True)
    tüm_uçak_overflight_dahil = Column(Float, nullable=False)
    uçak_trafiği = Column(Float, nullable=False)
    iç_hat = Column(Float, nullable=False)
    dış_hat = Column(Float, nullable=False)
    overflight_uçak_trafiği = Column(Float, nullable=False)


class AnnualCargoTraffic(Base):
    __tablename__ = "annual_cargo_traffic"

    yil = Column(Integer, primary_key=True, index=True)
    kargo_trafiği_ton = Column(Float, nullable=False)
    iç_hat_kargo_ton = Column(Float, nullable=False)
    dış_hat_kargo_ton = Column(Float, nullable=False)


class AnnualPassengerTraffic(Base):
    __tablename__ = "annual_passenger_traffic"

    yil = Column(Integer, primary_key=True, index=True)
    yolcu_trafiği_transit_dahil = Column(Float, nullable=False)
    yolcu_trafiği = Column(Float, nullable=False)
    iç_hat = Column(Float, nullable=False)
    dış_hat = Column(Float, nullable=False)
    direkt_transit = Column(Float, nullable=True)


class AnnualFreightTraffic(Base):
    __tablename__ = "annual_freight_traffic"

    yil = Column(Integer, primary_key=True, index=True)
    yük_trafiği_ton = Column(Float, nullable=False)
    iç_hat_ton = Column(Float, nullable=False)
    dış_hat_ton = Column(Float, nullable=False)

