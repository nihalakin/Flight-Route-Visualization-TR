from __future__ import annotations

import hashlib
import random
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence

from app.models.ticket_detail import TicketDetail
from app.models.ticket_segment import TicketSegment


def calculate_refund_amount_for_detail(
    detail: TicketDetail,
    segments: Sequence[TicketSegment],
    quote_date: date | None = None,
) -> float:
    """
    İade tutarını tek bir merkezi fonksiyonda hesaplar.

    Önizleme (Biletlerim) ve iptal (kupon oluşturma) akışlarının aynı tutarı göstermesi için
    bu fonksiyon determinizm sağlar (aynı input -> aynı output).
    """
    if not quote_date:
        quote_date = date.today()

    ticket_amount = detail.ticket_amount
    if not ticket_amount or ticket_amount <= 0:
        return 0.0

    today = quote_date
    ticket_amount_dec = Decimal(str(ticket_amount))

    departure_dates: list[date] = []
    for s in segments:
        if s.departure_datetime:
            departure_dates.append(s.departure_datetime.date())

    # Tutar oranını belirle (uçuşa kalan zamana göre kontrol edilen aralık)
    first_dep: date | None
    if not departure_dates:
        base_min = Decimal("0.05")
        base_max = Decimal("0.20")
        first_dep = None
    else:
        first_dep = min(departure_dates)
        days_to_departure = (first_dep - today).days
        if days_to_departure <= 0:
            base_min = Decimal("0.00")
            base_max = Decimal("0.10")
        elif days_to_departure <= 3:
            base_min = Decimal("0.10")
            base_max = Decimal("0.30")
        elif days_to_departure <= 7:
            base_min = Decimal("0.30")
            base_max = Decimal("0.60")
        else:
            base_min = Decimal("0.60")
            base_max = Decimal("0.90")

    # Deterministik "kontrollü rastgelelik": sabit inputlardan seed üret.
    seed_source = f"{today.isoformat()}|{(first_dep.isoformat() if first_dep else 'NA')}|{ticket_amount_dec}"
    seed = int(hashlib.sha256(seed_source.encode("utf-8")).hexdigest()[:16], 16)
    rng = random.Random(seed)

    # ratio'yu Decimal olarak alıp sabit yuvarlama uygularız.
    ratio = Decimal(str(rng.uniform(float(base_min), float(base_max))))
    refund = ticket_amount_dec * ratio
    if refund > ticket_amount_dec:
        refund = ticket_amount_dec
    if refund < 0:
        refund = Decimal("0.00")

    refund = refund.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(refund)

