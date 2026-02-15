from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import get_settings
from backend.schemas import AnalysisResponse, AnalyzeRequest, HealthResponse, VersionResponse
from backend.services.analyzer import AnalyzerService

load_dotenv()
settings = get_settings()
service = AnalyzerService(settings)

app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/assets", StaticFiles(directory=str(frontend_dir)), name="assets")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(frontend_dir / "index.html")


@app.post("/api/v2/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalyzeRequest) -> AnalysisResponse:
    return service.analyze(payload)


@app.get("/api/v2/health", response_model=HealthResponse)
def health() -> HealthResponse:
    status = service.health()
    return HealthResponse(status="ok", **status)


@app.get("/api/v2/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(
        name=settings.app_name,
        version=settings.app_version,
        config_fingerprint=settings.config_fingerprint,
    )
