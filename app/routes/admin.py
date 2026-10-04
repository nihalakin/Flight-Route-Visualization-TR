"""
Admin işlemleri:
- Kullanıcı listeleme / silme,
- Segment bazlı yorumları (comments) listeleme ve silme.
Sadece is_admin = True kullanıcılar erişebilir.
"""
import logging
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Airport, Coupon, User, Comment, TicketSegment, TicketDetail, UserCoupon, ContactForm
from app.models.comment import COMMENT_STATUS_APPROVED, COMMENT_STATUS_PENDING, COMMENT_STATUS_REJECTED
from app.repositories.review_analysis_repo import (
    get_airlines_with_unanalyzed_reviews,
    get_unanalyzed_approved_reviews_for_airline,
    get_unanalyzed_reviews_count,
    save_analysis_batch,
)
from app.routes.auth import get_current_admin
from app.services.review_analysis import ReviewAnalysisError, analyze_reviews
from app.services.api_health import get_all_api_statuses
from app.services.email_service import email_service

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

# Model token limit sebebiyle tek havayolu için yorumları parça parça göndermek daha güvenlidir.
REVIEW_ANALYSIS_BATCH_SIZE = 50


class ReviewUpdateBody(BaseModel):
    """Yorum güncelleme: title, content, status."""

    title: str | None = None
    content: str | None = None
    status: str | None = None


@router.get("/users", response_model=list[dict])
async def list_users(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Sistemdeki tüm kullanıcıları listeler.
    Admin dashboard için kullanılır.
    """
    users = db.query(User).order_by(User.created_at.desc()).all()
    results: list[dict] = []
    for u in users:
        results.append(
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "is_admin": bool(u.is_admin),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
        )
    return results


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Kullanıcı silme:
    - Sadece admin erişir (get_current_admin dependency).
    - Admin kendisini silemez.
    """
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin kendi hesabını silemez",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı",
        )

    db.delete(user)
    db.commit()
    return {"success": True, "message": "Kullanıcı başarıyla silindi"}


@router.get("/reviews", response_model=list[dict])
async def list_reviews(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    status_filter: str | None = None,
):
    """
    Segment bazlı yorumları (comments) listeler.
    Her kayıt: yorum + kullanıcı + segment (rota, havayolu) bilgisi.
    status_filter: pending | approved | rejected ile filtreleyebilirsiniz.
    """
    q = (
        db.query(Comment, User, TicketSegment)
        .join(User, User.id == Comment.user_id)
        .join(TicketSegment, TicketSegment.id == Comment.ticket_segment_id)
    )
    if status_filter and status_filter in (COMMENT_STATUS_PENDING, COMMENT_STATUS_APPROVED, COMMENT_STATUS_REJECTED):
        q = q.filter(Comment.status == status_filter)
    rows = q.order_by(Comment.created_at.desc()).all()
    results: list[dict] = []
    for c, u, seg in rows:
        route = ""
        if seg.departure_city or seg.departure_airport_code:
            route = (seg.departure_city or seg.departure_airport_code or "")
        if seg.arrival_city or seg.arrival_airport_code:
            route += " – " + (seg.arrival_city or seg.arrival_airport_code or "")
        results.append(
            {
                "id": c.id,
                "user_id": c.user_id,
                "user_first_name": u.first_name,
                "user_last_name": u.last_name,
                "user_username": u.username,
                "ticket_segment_id": c.ticket_segment_id,
                "segment_order": seg.segment_order,
                "airline_name": seg.airline_name,
                "route": route.strip(" –"),
                "title": c.title,
                "rating": c.rating,
                "content": c.content,
                "status": c.status or COMMENT_STATUS_PENDING,
                "is_analyzed": bool(getattr(c, "is_analyzed", False)),
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
        )
    return results


@router.post("/reviews/{review_id}/approve", status_code=status.HTTP_200_OK)
async def approve_review(
    review_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Yorumu onaylar (status=approved)."""
    comment = db.query(Comment).filter(Comment.id == review_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yorum bulunamadı")
    comment.status = COMMENT_STATUS_APPROVED
    comment.updated_at = datetime.utcnow()
    db.commit()
    return {"detail": "Yorum onaylandı"}


@router.post("/reviews/{review_id}/reject", status_code=status.HTTP_200_OK)
async def reject_review(
    review_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Yorumu reddeder (status=rejected)."""
    comment = db.query(Comment).filter(Comment.id == review_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yorum bulunamadı")
    comment.status = COMMENT_STATUS_REJECTED
    comment.updated_at = datetime.utcnow()
    db.commit()
    return {"detail": "Yorum reddedildi"}


@router.patch("/reviews/{review_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def update_review(
    review_id: int,
    data: ReviewUpdateBody,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Yorumu günceller (title, content, status)."""
    comment = db.query(Comment).filter(Comment.id == review_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yorum bulunamadı")
    if data.title is not None:
        comment.title = data.title.strip() or None
    if data.content is not None:
        comment.content = data.content.strip() or comment.content
    if data.status is not None and data.status in (COMMENT_STATUS_PENDING, COMMENT_STATUS_APPROVED, COMMENT_STATUS_REJECTED):
        comment.status = data.status
    comment.updated_at = datetime.utcnow()
    db.commit()
    return {"detail": "Yorum güncellendi"}


@router.get("/reviews/analysis-pending", response_model=dict)
async def get_pending_review_analysis_count(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Onaylı ve henüz analiz edilmemiş yorum sayısını döndürür."""
    pending_count = get_unanalyzed_reviews_count(db)
    return {"pending_count": pending_count}


@router.post("/reviews/analyze", status_code=status.HTTP_200_OK, response_model=dict)
async def analyze_pending_reviews(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Onaylı ve analiz edilmemiş yorumları admin tarafından tetiklenerek havayolu bazında batch analiz eder.
    Bekleyen veya reddedilen yorumlar işlenmez. Başarısız olursa ilgili yorumlar analiz edilmemiş kalır.
    """
    airlines = get_airlines_with_unanalyzed_reviews(db)
    if not airlines:
        return {"detail": "Onaylı ve analiz bekleyen yorum yok.", "processed_count": 0, "pending_count": 0}

    total_processed = 0
    failed_airlines: list[dict] = []

    # Havayolu bazında analiz yapmak UI tarafındaki `airline` parametresiyle birebir eşleşir.
    for airline_name in airlines:
        unanalyzed = get_unanalyzed_approved_reviews_for_airline(db, airline_name)
        if not unanalyzed:
            continue

        # Tek seferde tüm yorumları göndermek token limitine takılabileceği için güvenli chunk.
        for i in range(0, len(unanalyzed), REVIEW_ANALYSIS_BATCH_SIZE):
            batch = unanalyzed[i : i + REVIEW_ANALYSIS_BATCH_SIZE]
            review_ids = [r[0] for r in batch]
            if not review_ids:
                continue
            try:
                result = await analyze_reviews(batch)
                save_analysis_batch(db, review_ids, result, airline_name)
                total_processed += len(review_ids)
            except ReviewAnalysisError as e:
                # Hata olan parçadaki yorumlar `Comment.is_analyzed=False` kalır; tekrar basılınca yeniden analiz edilebilir.
                failed_airlines.append({"airline_name": airline_name, "error": str(e)})

    pending_count = get_unanalyzed_reviews_count(db)
    return {
        "detail": f"{total_processed} yorum havayolu bazlı batch analiz edildi.",
        "processed_count": total_processed,
        "pending_count": pending_count,
        "failed_airlines": failed_airlines,
    }


@router.delete("/reviews/{review_id}", status_code=status.HTTP_200_OK)
async def delete_review(
    review_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Segment yorumunu siler (comments tablosu)."""
    comment = db.query(Comment).filter(Comment.id == review_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yorum bulunamadı")
    db.delete(comment)
    db.commit()
    return {"detail": "Yorum silindi"}


# --- Kupon yönetimi ---


@router.get("/coupons", response_model=list[dict])
async def list_coupons(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Kuponları listeler (silinmemiş olanlar).
    """
    coupons = (
        db.query(Coupon)
        .filter(Coupon.deleted_at.is_(None))
        .order_by(Coupon.created_at.desc())
        .all()
    )
    results: list[dict] = []
    for c in coupons:
        results.append(
            {
                "id": c.id,
                "code": c.code,
                "airline_name": c.airline_name,
                "original_amount": c.original_amount,
                "refund_amount": c.refund_amount,
                "issue_date": c.issue_date.isoformat() if c.issue_date else None,
                "cancel_reason": c.cancel_reason,
                "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
                "max_uses": getattr(c, "max_uses", 1),
                "use_count": getattr(c, "use_count", 0),
                "is_active": c.is_active,
                "is_used": c.is_used,
                "used_at": c.used_at.isoformat() if c.used_at else None,
            }
        )
    return results


@router.get("/users/search", response_model=list[dict])
async def search_users(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(10, ge=1, le=50),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Kullanıcı arama (admin için autocomplete).

    - nickname (username) veya e-posta üzerinden arar.
    - Sadece aktif kullanıcılar döner.
    """
    term = q.strip()
    if not term:
        return []

    like_pattern = f"%{term.lower()}%"

    users = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            (User.username.ilike(like_pattern) | User.email.ilike(like_pattern)),
        )
        .order_by(User.created_at.desc())
        .limit(limit)
        .all()
    )
    results: list[dict] = []
    for u in users:
        results.append(
            {
                "id": u.id,
                "email": u.email,
                "username": u.username,
                "first_name": u.first_name,
                "last_name": u.last_name,
            }
        )
    return results


class CouponAssignBody(BaseModel):
    user_ids: list[int] = Field(default_factory=list, description="Kuponun atanacağı kullanıcı ID listesi")


@router.get("/coupons/{coupon_id}/users", response_model=list[dict])
async def get_coupon_users(
    coupon_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Belirli bir kupona atanmış kullanıcıları döner.
    """
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id, Coupon.deleted_at.is_(None)).first()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kupon bulunamadı")

    rows = (
        db.query(UserCoupon, User)
        .join(User, User.id == UserCoupon.user_id)
        .filter(UserCoupon.coupon_id == coupon_id)
        .order_by(UserCoupon.created_at.desc())
        .all()
    )

    results: list[dict] = []
    for uc, u in rows:
        results.append(
            {
                "id": u.id,
                "email": u.email,
                "username": u.username,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "assigned_at": uc.created_at.isoformat() if uc.created_at else None,
            }
        )
    return results


@router.post("/coupons/{coupon_id}/assign-users", status_code=status.HTTP_200_OK, response_model=dict)
async def assign_coupon_to_users(
    coupon_id: int,
    body: CouponAssignBody,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Kuponu bir veya birden fazla kullanıcıya atar.

    - Kullanıcılar benzersiz ID'leri ile ilişkilendirilir.
    - Aynı kullanıcıya aynı kupon ikinci kez atanmaz.
    - Kupon soft deleted ise atanamaz.
    """
    if not body.user_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="En az bir kullanıcı seçmelisiniz")

    coupon = db.query(Coupon).filter(Coupon.id == coupon_id, Coupon.deleted_at.is_(None)).first()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kupon bulunamadı")

    # Var olmayan kullanıcı ID'lerini ele
    existing_users = (
        db.query(User.id)
        .filter(User.id.in_(body.user_ids), User.is_active.is_(True))
        .all()
    )
    existing_ids = {row.id for row in existing_users}
    if not existing_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçerli kullanıcı bulunamadı")

    # Hali hazırda atanmış olanları hariç tut
    already_rows = (
        db.query(UserCoupon.user_id)
        .filter(UserCoupon.coupon_id == coupon_id, UserCoupon.user_id.in_(existing_ids))
        .all()
    )
    already_ids = {row.user_id for row in already_rows}

    new_ids = [uid for uid in existing_ids if uid not in already_ids]
    if not new_ids:
        return {"detail": "Seçilen tüm kullanıcılara kupon zaten atanmış"}

    created_count = 0
    for uid in new_ids:
        uc = UserCoupon(user_id=uid, coupon_id=coupon_id)
        db.add(uc)
        created_count += 1

    db.commit()

    return {
        "detail": f"{created_count} kullanıcıya kupon atandı",
        "assigned_count": created_count,
        "skipped_existing": len(already_ids),
    }


@router.delete("/coupons/{coupon_id}/users/{user_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def unassign_coupon_from_user(
    coupon_id: int,
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Kuponu belirli bir kullanıcıdan geri alır.

    - İlişki user_coupons tablosundan silinir.
    - Kuponun kendisi silinmez veya pasif hale getirilmez.
    """
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kupon bulunamadı")

    uc = (
        db.query(UserCoupon)
        .filter(UserCoupon.coupon_id == coupon_id, UserCoupon.user_id == user_id)
        .first()
    )
    if not uc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bu kullanıcıya bu kupon atanmış değil")

    db.delete(uc)
    db.commit()

    return {"detail": "Kupon kullanıcıdan kaldırıldı"}


class CouponCreate(BaseModel):
    code: str
    airline_name: str | None = None
    original_amount: float | None = None
    refund_amount: float
    issue_date: date | None = None
    cancel_reason: str | None = None
    expiry_date: date
    max_uses: int = Field(default=1, ge=1, description="Kaç kişi bu kuponu kullanabilir")
    is_active: bool = True
    user_ids: list[int] = Field(default=[], description="Kuponu kullanabilecek kullanıcı ID'leri. Boş ise tüm kullanıcılar için geçerli")


class CouponUpdate(BaseModel):
    airline_name: str | None = None
    original_amount: float | None = None
    refund_amount: float | None = None
    issue_date: date | None = None
    cancel_reason: str | None = None
    expiry_date: date | None = None
    max_uses: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


@router.post("/coupons", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_coupon(
    data: CouponCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Yeni kupon oluşturur."""
    code = (data.code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kupon kodu boş olamaz")

    existing = db.query(Coupon).filter(Coupon.code == code, Coupon.deleted_at.is_(None)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu kupon kodu zaten mevcut")

    max_uses = max(1, data.max_uses)
    coupon = Coupon(
        code=code,
        airline_name=(data.airline_name or "").strip() or None,
        original_amount=data.original_amount,
        refund_amount=data.refund_amount,
        issue_date=data.issue_date,
        cancel_reason=(data.cancel_reason or "").strip() or None,
        expiry_date=data.expiry_date,
        max_uses=max_uses,
        use_count=0,
        is_active=data.is_active,
        is_used=False,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)

    # Belirli kullanıcılara atama
    if data.user_ids:
        for user_id in data.user_ids:
            assignment = CouponUserAssignment(
                coupon_id=coupon.id,
                user_id=user_id,
                assigned_at=datetime.utcnow()
            )
            db.add(assignment)
        db.commit()

    return {"id": coupon.id, "code": coupon.code}


@router.patch("/coupons/{coupon_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def update_coupon(
    coupon_id: int,
    data: CouponUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Kupon bilgilerini günceller."""
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id, Coupon.deleted_at.is_(None)).first()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kupon bulunamadı")

    if data.airline_name is not None:
        coupon.airline_name = data.airline_name.strip() or None
    if data.original_amount is not None:
        coupon.original_amount = data.original_amount
    if data.refund_amount is not None:
        coupon.refund_amount = data.refund_amount
    if data.issue_date is not None:
        coupon.issue_date = data.issue_date
    if data.cancel_reason is not None:
        coupon.cancel_reason = data.cancel_reason.strip() or None
    if data.expiry_date is not None:
        coupon.expiry_date = data.expiry_date
    if data.max_uses is not None:
        coupon.max_uses = max(1, data.max_uses)
        if coupon.use_count > coupon.max_uses:
            coupon.use_count = coupon.max_uses
    if data.is_active is not None:
        coupon.is_active = data.is_active

    db.commit()
    return {"detail": "Kupon güncellendi"}


@router.delete("/coupons/{coupon_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def delete_coupon(
    coupon_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Kupon soft delete (deleted_at alanını doldurur, ayrıca is_active=False yapar)."""
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kupon bulunamadı")

    if coupon.deleted_at is not None:
        return {"detail": "Kupon zaten silinmiş"}

    coupon.deleted_at = datetime.utcnow()
    coupon.is_active = False
    db.commit()
    return {"detail": "Kupon silindi"}


# --- Havalimanı yönetimi ---


class AirportCreate(BaseModel):
    name: str
    city: str
    iata: str
    icao: str
    type: str | None = None
    year: int | None = None
    lat: float | None = None
    lon: float | None = None
    region: str | None = None
    flights: str | None = None


class AirportUpdate(BaseModel):
    name: str | None = None
    city: str | None = None
    iata: str | None = None
    icao: str | None = None
    type: str | None = None
    year: int | None = None
    lat: float | None = None
    lon: float | None = None
    region: str | None = None
    flights: str | None = None


@router.get("/airports", response_model=list[dict])
async def list_airports(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Veritabanındaki tüm havalimanlarını listeler.
    """
    airports = db.query(Airport).order_by(Airport.city.asc(), Airport.name.asc()).all()
    results: list[dict] = []
    for a in airports:
        results.append(
            {
                "id": a.id,
                "name": a.name,
                "city": a.city,
                "iata": a.iata,
                "icao": a.icao,
                "type": a.type,
                "year": a.year,
                "lat": a.lat,
                "lon": a.lon,
                "region": a.region,
                "flights": a.flights,
            }
        )
    return results


@router.post("/airports", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_airport(
    data: AirportCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Yeni havalimanı oluşturur.

    IATA ve ICAO kodları benzersiz kabul edilir.
    """
    name = (data.name or "").strip()
    city = (data.city or "").strip()
    iata = (data.iata or "").strip().upper()
    icao = (data.icao or "").strip().upper()

    if not name or not city or not iata or not icao:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="İsim, şehir, IATA ve ICAO alanları zorunludur",
        )

    # Benzersizlik kontrolleri
    if db.query(Airport).filter(Airport.iata == iata).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu IATA kodu zaten kayıtlı",
        )
    if db.query(Airport).filter(Airport.icao == icao).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu ICAO kodu zaten kayıtlı",
        )

    airport = Airport(
        name=name,
        city=city,
        iata=iata,
        icao=icao,
        type=(data.type or "").strip() or None,
        year=data.year,
        lat=data.lat,
        lon=data.lon,
        region=(data.region or "").strip() or None,
        flights=(data.flights or "").strip() or None,
    )
    db.add(airport)
    db.commit()
    db.refresh(airport)
    return {"id": airport.id}


@router.patch("/airports/{airport_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def update_airport(
    airport_id: int,
    data: AirportUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Mevcut bir havalimanını günceller.
    """
    airport = db.query(Airport).filter(Airport.id == airport_id).first()
    if not airport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Havalimanı bulunamadı",
        )

    if data.name is not None:
        airport.name = data.name.strip() or airport.name
    if data.city is not None:
        airport.city = data.city.strip() or airport.city
    if data.iata is not None:
        new_iata = data.iata.strip().upper()
        if new_iata and new_iata != airport.iata:
            exists = db.query(Airport).filter(Airport.iata == new_iata, Airport.id != airport.id).first()
            if exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bu IATA kodu başka bir havalimanında kullanılıyor",
                )
            airport.iata = new_iata
    if data.icao is not None:
        new_icao = data.icao.strip().upper()
        if new_icao and new_icao != airport.icao:
            exists = db.query(Airport).filter(Airport.icao == new_icao, Airport.id != airport.id).first()
            if exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bu ICAO kodu başka bir havalimanında kullanılıyor",
                )
            airport.icao = new_icao
    if data.type is not None:
        airport.type = data.type.strip() or None
    if data.year is not None:
        airport.year = data.year
    if data.lat is not None:
        airport.lat = data.lat
    if data.lon is not None:
        airport.lon = data.lon
    if data.region is not None:
        airport.region = data.region.strip() or None
    if data.flights is not None:
        airport.flights = data.flights.strip() or None

    db.commit()
    return {"detail": "Havalimanı güncellendi"}


@router.delete("/airports/{airport_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def delete_airport(
    airport_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Havalimanını siler (hard delete).
    """
    airport = db.query(Airport).filter(Airport.id == airport_id).first()
    if not airport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Havalimanı bulunamadı",
        )

    db.delete(airport)
    db.commit()
    return {"detail": "Havalimanı silindi"}


@router.get("/api-status", response_model=dict)
async def get_api_status(
    current_admin: User = Depends(get_current_admin),
):
    """
    Tüm API bağlantı durumlarını döndürür.
    """
    statuses = await get_all_api_statuses()
    return statuses


# --- İletişim formu yönetimi ---


@router.get("/contact-forms", response_model=list[dict])
async def list_contact_forms(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    status_filter: str | None = None,
):
    """
    İletişim formu gönderilerini listeler.
    status_filter: pending | in_progress | resolved | closed ile filtreleyebilirsiniz.
    """
    q = db.query(ContactForm)
    if status_filter:
        q = q.filter(ContactForm.status == status_filter)
    forms = q.order_by(ContactForm.created_at.desc()).all()
    results: list[dict] = []
    for f in forms:
        results.append(
            {
                "id": f.id,
                "name": f.name,
                "email": f.email,
                "subject": f.subject,
                "message": f.message,
                "status": f.status,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            }
        )
    return results


class ContactFormUpdate(BaseModel):
    status: str = Field(..., description="pending | in_progress | resolved | closed")


@router.patch("/contact-forms/{form_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def update_contact_form_status(
    form_id: int,
    data: ContactFormUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    İletişim formu durumunu günceller.
    """
    valid_statuses = {"pending", "in_progress", "resolved", "closed"}
    if data.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Geçersiz durum. Geçerli değerler: {', '.join(valid_statuses)}",
        )

    contact_form = db.query(ContactForm).filter(ContactForm.id == form_id).first()
    if not contact_form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="İletişim formu bulunamadı")

    contact_form.status = data.status
    contact_form.updated_at = datetime.utcnow()
    db.commit()
    return {"detail": "İletişim formu durumu güncellendi"}


@router.delete("/contact-forms/{form_id}", status_code=status.HTTP_200_OK, response_model=dict)
async def delete_contact_form(
    form_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    İletişim formunu siler.
    """
    contact_form = db.query(ContactForm).filter(ContactForm.id == form_id).first()
    if not contact_form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="İletişim formu bulunamadı")

    db.delete(contact_form)
    db.commit()
    return {"detail": "İletişim formu silindi"}


class ContactFormReply(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=5000)


@router.post("/contact-forms/{form_id}/reply", status_code=status.HTTP_200_OK, response_model=dict)
async def reply_to_contact_form(
    form_id: int,
    reply_data: ContactFormReply,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    İletişim formuna cevap gönderir.
    E-posta gönderme işlemi SMTP üzerinden yapılır.
    """
    contact_form = db.query(ContactForm).filter(ContactForm.id == form_id).first()
    if not contact_form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="İletişim formu bulunamadı")

    # E-posta gönderme işlemi
    email_body = f"""
Sayın {contact_form.name},

İletişim formunuza verdiğiniz cevap için teşekkür ederiz.

Orijinal Mesajınız:
{contact_form.message}

Cevabımız:
{reply_data.message}

Saygılarımızla,
Nodia Destek Ekibi
"""

    success = email_service.send_email(
        to_email=contact_form.email,
        subject=reply_data.subject,
        body=email_body.strip(),
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="E-posta gönderilemedi"
        )

    # Form durumunu güncelle
    contact_form.status = "replied"
    contact_form.updated_at = datetime.utcnow()
    db.commit()

    logger.info(
        f"Email reply sent to {contact_form.email} from nodiadestek@gmail.com\n"
        f"Subject: {reply_data.subject}\n"
        f"Message: {reply_data.message}"
    )

    return {
        "detail": "Cevap gönderildi",
        "to": contact_form.email,
        "from": "nodiadestek@gmail.com",
        "subject": reply_data.subject,
        "status": "replied"
    }
