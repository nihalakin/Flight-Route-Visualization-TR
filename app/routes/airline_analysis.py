from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException


router = APIRouter(prefix="/airline-analysis", tags=["airline-analysis"])


DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "airline_analysis_test.json"


@router.get("", response_model=Dict[str, Any])
async def get_airline_analysis() -> Dict[str, Any]:
    """
    scripts/analyze_airlines_reviews.py çıktısı olan
    data/airline_analysis_test.json dosyasını okuyup aynen döner.
    """
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail="Analiz dosyası bulunamadı. Önce analiz script'ini çalıştırın.")

    try:
        import json

        with DATA_PATH.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        if not isinstance(payload, dict):
            raise ValueError("JSON kökü dict değil")
        return payload
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - beklenmeyen hata
        raise HTTPException(status_code=500, detail=f"Analiz dosyası okunamadı: {exc}")

