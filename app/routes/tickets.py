"""
Kullanıcı biletleri: kaydetme, listeleme ve önizleme.
Hiyerarşi: Ticket → TicketDetail → TicketSegment.
Yorumlar her segment için ayrı (Comment → ticket_segment_id).
"""
from datetime import datetime, date, timedelta
import random

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ticket, TicketDetail, TicketSegment, Comment, User, Airline
from app.routes.auth import get_current_user

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _parse_duration_minutes(v):
    """None, int veya ISO 8601 süre (örn. PT1H55M) -> dakika (int) veya None."""
    if v is None:
        return None
    if isinstance(v, int):
        return v if v >= 0 else None
    if isinstance(v, str):
        s = (v or "").strip().upper()
        if not s:
            return None
        # PT1H55M veya PT55M formatı
        import re
        m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", s)
        if m:
            h = int(m.group(1) or 0)
            mn = int(m.group(2) or 0)
            return h * 60 + mn
        try:
            return int(float(s))
        except (ValueError, TypeError):
            return None
    return None


class SegmentCreate(BaseModel):
    """Tek uçuş bacağı."""
    segment_order: int = 1
    airline_id: int | None = None
    airline_name: str | None = None
    flight_number: str | None = None
    departure_city: str | None = None
    departure_airport_code: str | None = None
    arrival_city: str | None = None
    arrival_airport_code: str | None = None
    departure_datetime: datetime | None = None
    arrival_datetime: datetime | None = None
    segment_duration_minutes: int | None = None
    ticket_number: str | None = None

    @field_validator("segment_duration_minutes", mode="before")
    @classmethod
    def coerce_duration_minutes(cls, v):
        return _parse_duration_minutes(v)


class TicketDetailCreate(BaseModel):
    """
    Bilet detayı (segment dışı) + segment listesi.
    - Önerilen: details.segments ile her uçuş bacağı ayrı (direkt=1, aktarmalı=2+).
    - Eski format: segments boşsa aşağıdaki alanlardan segment(ler) üretilir.
    - Aktarmalı uçuş (eski format): segment_2_* alanları doluysa 2 segment oluşturulur:
      Segment 1: departure_* / arrival_* (ilk varış = aktarma noktası), flight_number, ...
      Segment 2: segment_2_departure_* (aktarma) / segment_2_arrival_* (son varış), segment_2_flight_number, ...
    """
    route_category: str | None = None  # "direct" | "connecting"
    total_duration_minutes: int | None = None

    @field_validator("total_duration_minutes", mode="before")
    @classmethod
    def coerce_total_duration(cls, v):
        return _parse_duration_minutes(v)
    passenger_count: int | None = None
    ticket_amount: float | None = None
    coupon_discount_amount: float | None = None
    coupon_code: str | None = None
    cabin_class: str | None = None
    pnr: str = ""
    segments: list[SegmentCreate] = []

    # --- Tek segment (direkt) eski format ---
    flight_number: str | None = None
    airline_name: str | None = None
    airline_id: int | None = None
    departure_city: str | None = None
    departure_airport_code: str | None = None
    arrival_city: str | None = None
    arrival_airport_code: str | None = None
    departure_datetime: datetime | None = None
    arrival_datetime: datetime | None = None
    ticket_number: str | None = None
    segment_duration_minutes: int | None = None

    # --- İkinci bacak (aktarma): doluysa 2 segment oluşturulur ---
    segment_2_flight_number: str | None = None
    segment_2_airline_name: str | None = None
    segment_2_airline_id: int | None = None
    segment_2_departure_city: str | None = None
    segment_2_departure_airport_code: str | None = None
    segment_2_arrival_city: str | None = None
    segment_2_arrival_airport_code: str | None = None
    segment_2_departure_datetime: datetime | None = None
    segment_2_arrival_datetime: datetime | None = None
    segment_2_duration_minutes: int | None = None
    segment_2_ticket_number: str | None = None


class TicketCreate(BaseModel):
    title: str
    html_content: str
    details: TicketDetailCreate | None = None


class SegmentResponse(BaseModel):
    id: int
    segment_order: int
    airline_id: int | None
    airline_name: str | None
    flight_number: str | None
    departure_city: str | None
    departure_airport_code: str | None
    arrival_city: str | None
    arrival_airport_code: str | None
    departure_datetime: datetime | None
    arrival_datetime: datetime | None
    segment_duration_minutes: int | None
    ticket_number: str | None
    has_comment: bool = False
    can_review: bool = False

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    id: int
    title: str
    created_at: str
    detail_id: int | None = None
    segments: list[SegmentResponse] = []
    can_review_any: bool = False
    can_review: bool = False  # Profil sayfası uyumluluğu (can_review_any ile aynı)
    has_review: bool = False  # En az bir segment için yorum yapılmış mı

    # İptal / kupon durumu için ek alanlar
    status: str = "active"  # "active" | "cancelled"
    can_cancel: bool = False
    pnr: str | None = None
    ticket_amount: float | None = None

    class Config:
        from_attributes = True


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TicketResponse)
async def create_ticket(
    data: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bilet oluşturur. details.segments ile her uçuş bacağı ayrı kayıt olur."""
    try:
        ticket = Ticket(
            user_id=current_user.id,
            title=data.title[:255] if data.title else "Bilet",
            html_content=data.html_content,
        )
        db.add(ticket)
        db.flush()

        if data.details:
            d = data.details
            # 1) Açık segment listesi varsa doğrudan kullan (her bacak ayrı kayıt)
            segments_to_use = list(d.segments) if d.segments else []

            # 2) Aktarmalı eski format: segment_2_* doluysa 2 bacak oluştur
            has_second_leg = (
                d.segment_2_flight_number or d.segment_2_airline_name
                or d.segment_2_departure_airport_code or d.segment_2_arrival_airport_code
                or d.segment_2_departure_datetime or d.segment_2_arrival_datetime
            )
            if not segments_to_use and has_second_leg and (
                d.flight_number or d.airline_name or d.departure_airport_code or d.arrival_airport_code
                or d.departure_datetime or d.arrival_datetime
            ):
                # Segment 1: İlk bacağı (kalkış → aktarma noktası). arrival_* = aktarma şehri
                # Segment 2: İkinci bacak (aktarma → son varış)
                segments_to_use = [
                    SegmentCreate(
                        segment_order=1,
                        airline_id=d.airline_id,
                        airline_name=d.airline_name,
                        flight_number=d.flight_number,
                        departure_city=d.departure_city,
                        departure_airport_code=d.departure_airport_code,
                        arrival_city=d.arrival_city,
                        arrival_airport_code=d.arrival_airport_code,
                        departure_datetime=d.departure_datetime,
                        arrival_datetime=d.arrival_datetime,
                        segment_duration_minutes=d.segment_duration_minutes,
                        ticket_number=d.ticket_number,
                    ),
                    SegmentCreate(
                        segment_order=2,
                        airline_id=d.segment_2_airline_id,
                        airline_name=d.segment_2_airline_name,
                        flight_number=d.segment_2_flight_number,
                        departure_city=d.segment_2_departure_city,
                        departure_airport_code=d.segment_2_departure_airport_code,
                        arrival_city=d.segment_2_arrival_city,
                        arrival_airport_code=d.segment_2_arrival_airport_code,
                        departure_datetime=d.segment_2_departure_datetime,
                        arrival_datetime=d.segment_2_arrival_datetime,
                        segment_duration_minutes=d.segment_2_duration_minutes,
                        ticket_number=d.segment_2_ticket_number,
                    ),
                ]
            # 3) Tek bacak (direkt) eski format
            elif not segments_to_use and (
                d.flight_number or d.airline_name or d.departure_airport_code or d.arrival_airport_code
                or d.departure_datetime or d.arrival_datetime or d.ticket_number
            ):
                segments_to_use = [
                    SegmentCreate(
                        segment_order=1,
                        airline_id=d.airline_id,
                        airline_name=d.airline_name,
                        flight_number=d.flight_number,
                        departure_city=d.departure_city,
                        departure_airport_code=d.departure_airport_code,
                        arrival_city=d.arrival_city,
                        arrival_airport_code=d.arrival_airport_code,
                        departure_datetime=d.departure_datetime,
                        arrival_datetime=d.arrival_datetime,
                        segment_duration_minutes=d.segment_duration_minutes or d.total_duration_minutes,
                        ticket_number=d.ticket_number,
                    )
                ]
            if not segments_to_use:
                segments_to_use = [SegmentCreate(segment_order=1)]

            # Aktarmalı uçuşta route_category = connecting (gönderilmediyse otomatik)
            route_category = (d.route_category or "").strip() or None
            if not route_category and len(segments_to_use) > 1:
                route_category = "connecting"

            detail = TicketDetail(
                user_id=current_user.id,
                ticket_id=ticket.id,
                route_category=route_category,
                total_duration_minutes=d.total_duration_minutes,
                passenger_count=d.passenger_count,
                ticket_amount=d.ticket_amount,
                coupon_discount_amount=d.coupon_discount_amount,
                coupon_code=d.coupon_code[:50] if d.coupon_code else None,
                cabin_class=d.cabin_class[:50] if d.cabin_class else None,
                pnr=(d.pnr or "")[:20] or "N/A",
            )
            db.add(detail)
            db.flush()

            # Bilet numarası tüm bacaklar için aynı; ilk segmentte varsa diğerlerine de uygula
            common_ticket_number = None
            for seg in segments_to_use:
                if seg.ticket_number and (seg.ticket_number or "").strip():
                    common_ticket_number = (seg.ticket_number or "").strip()[:30]
                    break
            if not common_ticket_number and data.details and (getattr(data.details, "ticket_number", None) or "").strip():
                common_ticket_number = (getattr(data.details, "ticket_number", "") or "").strip()[:30]

            for i, seg in enumerate(segments_to_use):
                order = seg.segment_order if seg.segment_order >= 1 else (i + 1)
                tn = (seg.ticket_number or "").strip()[:30] if seg.ticket_number else None
                if not tn and common_ticket_number:
                    tn = common_ticket_number

                # airline_id ile airline_name eşleştir: name varsa id bul, id varsa name doldur
                seg_airline_id = seg.airline_id
                seg_airline_name = (seg.airline_name or "").strip()[:120] or None
                if seg_airline_id and not seg_airline_name:
                    airline_row = db.query(Airline).filter(Airline.id == seg_airline_id).first()
                    if airline_row:
                        seg_airline_name = airline_row.name
                elif seg_airline_name and not seg_airline_id:
                    airline_row = (
                        db.query(Airline)
                        .filter(func.lower(Airline.name) == seg_airline_name.lower())
                        .first()
                    )
                    if airline_row:
                        seg_airline_id = airline_row.id

                segment = TicketSegment(
                    ticket_detail_id=detail.id,
                    segment_order=order,
                    airline_id=seg_airline_id,
                    airline_name=seg_airline_name,
                    flight_number=seg.flight_number[:20] if seg.flight_number else None,
                    departure_city=seg.departure_city[:120] if seg.departure_city else None,
                    departure_airport_code=seg.departure_airport_code[:10] if seg.departure_airport_code else None,
                    arrival_city=seg.arrival_city[:120] if seg.arrival_city else None,
                    arrival_airport_code=seg.arrival_airport_code[:10] if seg.arrival_airport_code else None,
                    departure_datetime=seg.departure_datetime,
                    arrival_datetime=seg.arrival_datetime,
                    segment_duration_minutes=seg.segment_duration_minutes,
                    ticket_number=tn,
                )
                db.add(segment)

            if d.coupon_code:
                code = (d.coupon_code or "").strip().upper()
                if code:
                    coupon = (
                        db.query(Coupon)
                        .filter(
                            Coupon.code == code,
                            Coupon.deleted_at.is_(None),
                        )
                        .first()
                    )
                    if coupon:
                        max_uses = getattr(coupon, "max_uses", 1)
                        use_count = getattr(coupon, "use_count", 0)
                        if coupon.is_used or use_count >= max_uses:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Kupon kullanım limiti dolmuştur." if use_count >= max_uses else "Bu kupon kodu daha önce kullanılmış.",
                            )
                        today = datetime.utcnow().date()
                        if not coupon.is_active or coupon.expiry_date < today:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Kupon kodu aktif değil veya süresi dolmuş.",
                            )
                        coupon.use_count = use_count + 1
                        coupon.used_at = datetime.utcnow()
                        coupon.used_by_user_id = current_user.id
                        if coupon.use_count >= max_uses:
                            coupon.is_used = True
                        if detail.coupon_discount_amount is None and coupon.refund_amount is not None:
                            detail.coupon_discount_amount = coupon.refund_amount

        db.commit()
        db.refresh(ticket)
        return _ticket_to_response(db, ticket, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bilet oluşturulamadı: {e}",
        )


def _ticket_to_response(db: Session, ticket: Ticket, user_id: int) -> TicketResponse:
    detail = (
        db.query(TicketDetail)
        .filter(TicketDetail.ticket_id == ticket.id, TicketDetail.user_id == user_id)
        .first()
    )
    segments: list[SegmentResponse] = []
    can_review_any = False
    has_review_any = False
    can_cancel = False
    status = "active"
    pnr: str | None = None
    ticket_amount: float | None = None
    if detail:
        pnr = detail.pnr
        ticket_amount = detail.ticket_amount
        # Kupon kodu varsa bu bileti iptal edilmiş kabul et
        if detail.coupon_code:
            status = "cancelled"

        segs = (
            db.query(TicketSegment)
            .filter(TicketSegment.ticket_detail_id == detail.id)
            .order_by(TicketSegment.segment_order)
            .all()
        )
        now = datetime.utcnow()
        has_future_flight = False
        for s in segs:
            has_comment = (
                db.query(Comment)
                .filter(Comment.ticket_segment_id == s.id, Comment.user_id == user_id)
                .first()
                is not None
            )
            if has_comment:
                has_review_any = True
            dep = s.departure_datetime
            arr = s.arrival_datetime
            # Varış veya kalkış zamanı geçmişse uçuş tamamlanmış sayılır (naive/UTC karşılaştırma)
            flight_done = (dep is not None and dep < now) or (arr is not None and arr < now)
            # Bilet iptal edildiyse (status == cancelled) artık yorum yapılamaz
            can_review = (status == "active") and (not has_comment) and flight_done
            if can_review:
                can_review_any = True

            # Gelecekteki en az bir bacak varsa ve bilet aktifse iptal edilebilir kabul et
            if status == "active" and dep and dep > now:
                has_future_flight = True

            segments.append(
                SegmentResponse(
                    id=s.id,
                    segment_order=s.segment_order,
                    airline_id=s.airline_id,
                    airline_name=s.airline_name,
                    flight_number=s.flight_number,
                    departure_city=s.departure_city,
                    departure_airport_code=s.departure_airport_code,
                    arrival_city=s.arrival_city,
                    arrival_airport_code=s.arrival_airport_code,
                    departure_datetime=s.departure_datetime,
                    arrival_datetime=s.arrival_datetime,
                    segment_duration_minutes=s.segment_duration_minutes,
                    ticket_number=s.ticket_number,
                    has_comment=has_comment,
                    can_review=can_review,
                )
            )
        can_cancel = (status == "active") and has_future_flight
    return TicketResponse(
        id=ticket.id,
        title=ticket.title,
        created_at=ticket.created_at.isoformat() if ticket.created_at else "",
        detail_id=detail.id if detail else None,
        segments=segments,
        can_review_any=can_review_any,
        can_review=can_review_any,
        has_review=has_review_any,
        status=status,
        can_cancel=can_cancel,
        pnr=pnr,
        ticket_amount=ticket_amount,
    )


def _compute_refund_amount_for_detail(
    detail: TicketDetail,
    segments: list[TicketSegment],
) -> float:
    """
    Uçuş tarihine göre random ama kontrollü bir iade tutarı üretir.
    - Uçuş tarihine az kaldıkça oran düşük,
    - Uçuş tarihine çok varsa oran yüksek olur.
    - İade tutarı hiçbir zaman bilet tutarından fazla olamaz.
    """
    if not detail.ticket_amount or detail.ticket_amount <= 0:
        return 0.0

    today = date.today()

    future_dates: list[date] = []
    for s in segments:
        if s.departure_datetime:
            future_dates.append(s.departure_datetime.date())

    if not future_dates:
        # Tarih yoksa konservatif: düşük oranlar
        base_min, base_max = 0.05, 0.20
    else:
        first_dep = min(future_dates)
        days_to_departure = (first_dep - today).days

        if days_to_departure <= 0:
            # Uçuş günü veya geçmiş
            base_min, base_max = 0.0, 0.10
        elif days_to_departure <= 3:
            base_min, base_max = 0.10, 0.30
        elif days_to_departure <= 7:
            base_min, base_max = 0.30, 0.60
        else:
            base_min, base_max = 0.60, 0.90

    ratio = random.uniform(base_min, base_max)
    refund = detail.ticket_amount * ratio
    refund = min(refund, detail.ticket_amount)
    return round(refund, 2)


class TicketCancelPreviewResponse(BaseModel):
    ticket_id: int
    pnr: str | None
    ticket_amount: float | None
    refund_amount: float
    currency: str = "TRY"
    applies_to_ticket_ids: list[int] = []


class TicketCancelRequest(BaseModel):
    reason: str | None = None


@router.get("", response_model=list[TicketResponse])
async def list_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının biletlerini segmentlerle listeler."""
    tickets = (
        db.query(Ticket)
        .filter(Ticket.user_id == current_user.id)
        .order_by(Ticket.created_at.desc())
        .all()
    )
    if not tickets:
        return []
    return [_ticket_to_response(db, t, current_user.id) for t in tickets]


@router.get("/{ticket_id}/segments", response_model=list[SegmentResponse])
async def list_ticket_segments(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Biletin segmentlerini döner (sahibi erişebilir)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilet bulunamadı")
    detail = (
        db.query(TicketDetail)
        .filter(TicketDetail.ticket_id == ticket.id, TicketDetail.user_id == current_user.id)
        .first()
    )
    if not detail:
        return []
    segs = (
        db.query(TicketSegment)
        .filter(TicketSegment.ticket_detail_id == detail.id)
        .order_by(TicketSegment.segment_order)
        .all()
    )
    now = datetime.utcnow()
    out: list[SegmentResponse] = []
    is_cancelled = bool(detail.coupon_code)
    for s in segs:
        has_comment = (
            db.query(Comment)
            .filter(Comment.ticket_segment_id == s.id, Comment.user_id == current_user.id)
            .first()
            is not None
        )
        dep, arr = s.departure_datetime, s.arrival_datetime
        flight_done = (dep and dep < now) or (arr and arr < now)
        # Bilet iptal edildiyse yorum yapılamaz
        can_review = (not is_cancelled) and (not has_comment) and flight_done
        out.append(
            SegmentResponse(
                id=s.id,
                segment_order=s.segment_order,
                airline_id=s.airline_id,
                airline_name=s.airline_name,
                flight_number=s.flight_number,
                departure_city=s.departure_city,
                departure_airport_code=s.departure_airport_code,
                arrival_city=s.arrival_city,
                arrival_airport_code=s.arrival_airport_code,
                departure_datetime=s.departure_datetime,
                arrival_datetime=s.arrival_datetime,
                segment_duration_minutes=s.segment_duration_minutes,
                ticket_number=s.ticket_number,
                has_comment=has_comment,
                can_review=can_review,
            )
        )
    return out


@router.post("/{ticket_id}/cancel-preview", response_model=TicketCancelPreviewResponse)
async def preview_ticket_cancellation(
    ticket_id: int,
    data: TicketCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bilet iptali için iade tutarını hesaplar, hiçbir veritabanı değişikliği yapmaz.
    PNR'si aynı olan diğer biletlerin de etkileneceğini bildirir.
    """
    ticket = (
        db.query(Ticket)
        .filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilet bulunamadı")

    detail = (
        db.query(TicketDetail)
        .filter(TicketDetail.ticket_id == ticket.id, TicketDetail.user_id == current_user.id)
        .first()
    )
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilet detayı bulunamadı")

    if detail.coupon_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu bilet daha önce iptal edilmiş.",
        )

    pnr = detail.pnr
    sibling_details = (
        db.query(TicketDetail)
        .join(Ticket, Ticket.id == TicketDetail.ticket_id)
        .filter(
            TicketDetail.user_id == current_user.id,
            TicketDetail.pnr == pnr,
        )
        .all()
    )
    sibling_ticket_ids = [d.ticket_id for d in sibling_details]

    segments = (
        db.query(TicketSegment)
        .filter(TicketSegment.ticket_detail_id == detail.id)
        .all()
    )
    refund_amount = _compute_refund_amount_for_detail(detail, segments)

    return TicketCancelPreviewResponse(
        ticket_id=ticket.id,
        pnr=pnr,
        ticket_amount=detail.ticket_amount,
        refund_amount=refund_amount,
        applies_to_ticket_ids=sibling_ticket_ids,
    )


@router.post("/{ticket_id}/cancel", response_model=dict)
async def cancel_ticket(
    ticket_id: int,
    data: TicketCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bileti iptal eder:
    - Aynı PNR'ye sahip tüm TicketDetail kayıtlarını iptal kabul eder,
    - Her biri için iade kuponu oluşturur,
    - TicketDetail.coupon_code alanını kupon kodu ile doldurur,
    - Kullanıcı ile kuponu user_coupons üzerinden ilişkilendirir.
    """
    from app.models import Coupon, UserCoupon

    ticket = (
        db.query(Ticket)
        .filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilet bulunamadı")

    detail = (
        db.query(TicketDetail)
        .filter(TicketDetail.ticket_id == ticket.id, TicketDetail.user_id == current_user.id)
        .first()
    )
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilet detayı bulunamadı")

    if detail.coupon_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu bilet daha önce iptal edilmiş.",
        )

    pnr = detail.pnr
    cancel_reason = (data.reason or "").strip() or "Kullanıcı isteğiyle bilet iptali"

    sibling_details = (
        db.query(TicketDetail)
        .join(Ticket, Ticket.id == TicketDetail.ticket_id)
        .filter(
            TicketDetail.user_id == current_user.id,
            TicketDetail.pnr == pnr,
        )
        .all()
    )
    if not sibling_details:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="İlgili PNR için detay bulunamadı")

    created_coupons: list[dict] = []
    today = date.today()
    expiry_date = today + timedelta(days=365)

    try:
        for d in sibling_details:
            # Zaten iptal edilmiş olanları atla
            if d.coupon_code:
                continue

            segs = (
                db.query(TicketSegment)
                .filter(TicketSegment.ticket_detail_id == d.id)
                .all()
            )
            refund_amount = _compute_refund_amount_for_detail(d, segs)

            if not d.ticket_amount or d.ticket_amount <= 0 or refund_amount <= 0:
                continue

            suffix = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=4))
            base_pnr = (pnr or "PNR").replace(" ", "").upper()
            code = f"{base_pnr}-{suffix}"[:20]

            # Aynı kod varsa küçük bir varyasyon dene
            retries = 0
            while (
                db.query(Coupon)
                .filter(Coupon.code == code, Coupon.deleted_at.is_(None))
                .first()
                and retries < 5
            ):
                suffix = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=4))
                code = f"{base_pnr}-{suffix}"[:20]
                retries += 1

            coupon = Coupon(
                code=code,
                airline_name=(segs[0].airline_name if segs and segs[0].airline_name else None),
                airline_id=(segs[0].airline_id if segs and segs[0].airline_id else None),
                original_amount=d.ticket_amount,
                refund_amount=refund_amount,
                issue_date=today,
                cancel_reason=cancel_reason,
                expiry_date=expiry_date,
                max_uses=1,
                use_count=0,
                is_active=True,
                is_used=False,
            )
            db.add(coupon)
            db.flush()

            d.coupon_code = code

            uc = UserCoupon(user_id=current_user.id, coupon_id=coupon.id)
            db.add(uc)

            created_coupons.append(
                {
                    "ticket_id": d.ticket_id,
                    "ticket_detail_id": d.id,
                    "coupon_code": code,
                    "refund_amount": refund_amount,
                }
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    if not created_coupons:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu PNR için iade kuponu oluşturulamadı.",
        )

    return {
        "detail": "Bilet(ler) iptal edildi ve kupon(lar) oluşturuldu.",
        "pnr": pnr,
        "coupons": created_coupons,
    }


@router.get("/{ticket_id}/preview", response_class=HTMLResponse)
async def preview_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bilet önizlemesi (sadece bilet sahibi)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilet bulunamadı")
    return HTMLResponse(content=ticket.html_content)
