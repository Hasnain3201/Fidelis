from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.router import api_router
from app.core.config import settings
from app.services.scraper.worker import start_worker, stop_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    provider = (settings.scraper_ai_provider or "gemini").strip().lower()
    if provider == "gemini":
        ai_key_configured = bool(settings.google_api_key)
    elif provider == "groq":
        ai_key_configured = bool(settings.groq_api_key)
    else:
        ai_key_configured = False
    if settings.scraper_worker_autostart and ai_key_configured:
        await start_worker(max_jobs=settings.scraper_worker_max_jobs)
    try:
        yield
    finally:
        await stop_worker()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="LIVEY API: event discovery, venue management, and artist workflows.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {"service": settings.app_name, "status": "ok"}
