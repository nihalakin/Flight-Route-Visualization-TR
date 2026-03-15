from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)

from app.database import Base


class Coupon(Base):
    """İade biletlerinden üretilen kupon kodları.

    CSV'deki alanlar:
    - pnr_kodu -> code
    - havayolu -> airline_name (ve opsiyonel airline_id)
    - bilet_tutari_tl -> original_amount
    - iade_edilen_tutar_tl -> refund_amount
    - iade_tarihi -> issue_date
    - iptal_nedeni -> cancel_reason
    - son_kullanim_tarihi -> expiry_date
    """

    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)

    code = Column(String(20), unique=True, nullable=False, index=True)

    airline_name = Column(String(120), nullable=True)
    airline_id = Column(Integer, ForeignKey("airlines.id"), nullable=True, index=True)

    original_amount = Column(Float, nullable=True)
    refund_amount = Column(Float, nullable=True)

    issue_date = Column(Date, nullable=True)
    cancel_reason = Column(String(255), nullable=True)
    expiry_date = Column(Date, nullable=False, index=True)

    max_uses = Column(Integer, default=1, nullable=False)
    use_count = Column(Integer, default=0, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime, nullable=True)
    used_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    deleted_at = Column(DateTime, nullable=True)

