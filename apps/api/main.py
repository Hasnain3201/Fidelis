from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.router import api_router
from app.core.config import settings
from app.services.scraper.worker import start_worker, stop_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Boot the in-process scrape worker so it can drain scrape_jobs.
    await start_worker()
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
