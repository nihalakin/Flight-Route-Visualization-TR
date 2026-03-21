# Nodia FastAPI sunucusunu baslatir
# Kullanim: .\run.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$venvPython = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Hata: .venv bulunamadi. Once 'python -m venv .venv' ve 'pip install -r requirements.txt' calistirin."
    exit 1
}

Set-Location $root
& $venvPython -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
