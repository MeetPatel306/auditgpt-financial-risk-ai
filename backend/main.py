from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from pathlib import Path
import os

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

from database import users_collection, analyses_collection, portfolios_collection
from services.nse_validator import refresh_nse_list_from_website


# Load .env
_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent
load_dotenv(dotenv_path=_HERE / ".env", override=False)
load_dotenv(dotenv_path=_REPO_ROOT / ".env", override=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await users_collection.create_index("email", unique=True)
    await analyses_collection.create_index("userId")
    await analyses_collection.create_index([("userId", 1), ("createdAt", -1)])
    await portfolios_collection.create_index("userId", unique=True)
    refresh_nse_list_from_website()
    yield


# ✅ CREATE APP FIRST
app = FastAPI(title="AuditGPT API", version="1.0.0", lifespan=lifespan)

# ✅ CORS Middleware - handles all CORS including preflight
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    max_age=86400,
)


# ✅ ROUTES
app.include_router(analysis.router,           prefix="/api")
app.include_router(auth.router,               prefix="/auth")
app.include_router(report.router,             prefix="/api")
app.include_router(portfolio.router,          prefix="/api")
app.include_router(alerts.router,             prefix="/api")
app.include_router(history.router,            prefix="/api")
app.include_router(saved_portfolio.router,    prefix="/api")
app.include_router(live_price.router,         prefix="/api")


# ✅ ROOT
@app.get("/")
@app.head("/")
def root():
    return {"status": "AuditGPT API running", "version": "1.0.0"}

@app.get("/test-cors")
def test_cors():
    """Simple endpoint to test CORS"""
    return {"message": "CORS is working"}
