import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load application configuration before importing modules that read it at import time.
_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent
load_dotenv(dotenv_path=_HERE / ".env", override=False)
load_dotenv(dotenv_path=_REPO_ROOT / ".env", override=False)
load_dotenv(dotenv_path=_REPO_ROOT / "frontend" / ".env", override=False)

from routers import (
    analysis,
    auth,
    report,
    portfolio,
    alerts,
    history,
    saved_portfolio,
    live_price,
)
from database import users_collection, analyses_collection, portfolios_collection, get_client, close_client, DB_NAME
from services.nse_validator import refresh_nse_list_from_website

# ── Structured logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
# Silence noisy third-party loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("yfinance").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("peewee").setLevel(logging.WARNING)


logger = logging.getLogger("auditgpt")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Force a connection check so a missing MongoDB is logged clearly at startup.
        await get_client().admin.command("ping")
        logger.info("Connected to MongoDB database %s", DB_NAME)
        # Create unique index on email for fast lookups and duplicate prevention
        await users_collection.create_index("email", unique=True)
        await users_collection.create_index("google_id", unique=True, sparse=True)
        # Index on userId for efficient history queries
        await analyses_collection.create_index("userId")
        await analyses_collection.create_index([("userId", 1), ("createdAt", -1)])
        # One portfolio document per user
        await portfolios_collection.create_index("userId", unique=True)
    except Exception:
        logger.exception(
            "MongoDB is unavailable during startup; authentication will return 503 until it is reachable."
        )
    # Keep NSE symbols fresh for newly listed / renamed companies.
    refresh_nse_list_from_website()
    yield
    close_client()


app = FastAPI(title="AuditGPT API", version="1.0.0", lifespan=lifespan)

cors_origins_env = os.getenv("CORS_ORIGINS", "").strip()
allowed_origins = (
    [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    if cors_origins_env
    else ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router,           prefix="/api")
app.include_router(auth.router,               prefix="/auth")
app.include_router(auth.router,               prefix="/api/auth")
app.include_router(report.router,             prefix="/api")
app.include_router(portfolio.router,          prefix="/api")
app.include_router(alerts.router,             prefix="/api")
app.include_router(history.router,            prefix="/api")
app.include_router(saved_portfolio.router,    prefix="/api")
app.include_router(live_price.router,         prefix="/api")


@app.get("/")
def root():
    return {"status": "AuditGPT API running", "version": "1.0.0"}
