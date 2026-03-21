# FastAPI Application Package
import sys
from pathlib import Path

# Proje kökü (Nodia) - ilk import'ta path'e ekle
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
