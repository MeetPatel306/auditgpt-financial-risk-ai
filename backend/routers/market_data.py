"""
Market Data Router — AuditGPT
Provides endpoints for historical OHLCV price data and batch sync management.

Endpoints
─────────
GET  /api/market-data/{symbol}/history   – return stored OHLCV records
GET  /api/market-data/{symbol}/meta      – return metadata without all records
POST /api/market-data/sync/{symbol}      – sync one symbol on-demand (auth required)
POST /api/market-data/sync-all           – trigger full batch sync (auth required)
GET  /api/market-data/sync-status        – return last sync job status
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from services.historical_price import (
    get_stored_history,
    get_history_meta,
    fetch_and_store_history,
    price_history_collection,
)
from services.batch_sync import sync_symbol, sync_all_symbols, get_latest_sync_status

logger = logging.getLogger("auditgpt.market_data")
router = APIRouter(tags=["market-data"])

optional_security = HTTPBearer(auto_error=False)
required_security = HTTPBearer(auto_error=True)


async def _resolve_user(credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    """Return the email of the authenticated user, or None for unauthenticated calls."""
    if not credentials:
        return None
    try:
        from services.auth import JWT_SECRET, JWT_ALGORITHM
        from jose import JWTError, jwt as jose_jwt
        from database import users_collection

        payload = jose_jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        user = await users_collection.find_one({"email": email})
        return user["email"] if user else None
    except Exception:
        return None


# ── History retrieval ──────────────────────────────────────────────────────────

PERIOD_TO_DAYS: dict[str, int] = {
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
    "3y": 365 * 3,
    "5y": 365 * 5,
    "10y": 365 * 10,
    "max": 365 * 11,   # returns everything stored
}


@router.get("/market-data/{symbol}/history")
async def get_history(
    symbol: str,
    period: str = Query("10y", description="One of: 1m 3m 6m 1y 3y 5y 10y max"),
    limit: int = Query(3650, ge=1, le=5000, description="Max records to return"),
):
    """
    Return stored OHLCV records for `symbol`.
    If no data is stored, trigger a live fetch first (once-per-request fallback).
    """
    sym = symbol.upper().strip()
    period_key = period.lower().strip()
    days = PERIOD_TO_DAYS.get(period_key, 3650)
    effective_limit = min(limit, days)

    docs = await get_stored_history(sym, limit=effective_limit)

    # If nothing is stored, do a live fetch now so the endpoint is useful immediately
    if not docs:
        logger.info("No stored history for %s — fetching now", sym)
        fetch_result = await fetch_and_store_history(sym)
        if fetch_result.get("success"):
            docs = await get_stored_history(sym, limit=effective_limit)
        else:
            return {
                "symbol": sym,
                "period": period,
                "count": 0,
                "records": [],
                "start_date": None,
                "end_date": None,
                "years_available": 0.0,
                "data_available": False,
                "warning": fetch_result.get("error") or "No historical data available from Yahoo Finance.",
            }

    # Apply period filter: return only the most recent `days` calendar days
    if docs and period_key != "max":
        from datetime import date, timedelta
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        docs = [d for d in docs if d["date"] >= cutoff]

    if not docs:
        meta = await get_history_meta(sym)
        return {
            "symbol": sym,
            "period": period,
            "count": 0,
            "records": [],
            "start_date": meta.get("start_date"),
            "end_date": meta.get("end_date"),
            "years_available": 0.0,
            "data_available": bool(meta.get("count", 0)),
            "warning": f"No data for period '{period}'. Try a longer period — earliest stored data is from {meta.get('start_date')}.",
        }

    start_date = docs[0]["date"]
    end_date = docs[-1]["date"]
    try:
        from datetime import date as _date
        s = _date.fromisoformat(start_date)
        e = _date.fromisoformat(end_date)
        years_available = round((e - s).days / 365.25, 1)
    except Exception:
        years_available = 0.0

    return {
        "symbol": sym,
        "period": period,
        "count": len(docs),
        "records": docs,
        "start_date": start_date,
        "end_date": end_date,
        "years_available": years_available,
        "data_available": True,
        "warning": None if years_available >= 9.5 else (
            f"Only {years_available} years of data available. "
            "Full 10-year history may not be available for this company."
        ),
    }


@router.get("/market-data/{symbol}/meta")
async def get_symbol_meta(symbol: str):
    """Return metadata (record count, date range) without sending all OHLCV records."""
    sym = symbol.upper().strip()
    meta = await get_history_meta(sym)
    return meta


# ── On-demand single-symbol sync ──────────────────────────────────────────────

@router.post("/market-data/sync/{symbol}")
async def sync_one_symbol(
    symbol: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
):
    """
    Trigger an immediate sync for a single symbol.
    Available to authenticated users; unauthenticated callers receive 401.
    """
    user = await _resolve_user(credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required to sync historical data.")

    sym = symbol.upper().strip()
    logger.info("On-demand sync triggered by %s for %s", user, sym)

    result = await sync_symbol(sym, years=10)
    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=result.get("error") or f"Sync failed for {sym}",
        )
    return result


# ── Full batch sync ────────────────────────────────────────────────────────────

_sync_lock = asyncio.Lock()
_sync_running = False


@router.post("/market-data/sync-all")
async def trigger_sync_all(
    background_tasks: BackgroundTasks,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
):
    """
    Trigger a full batch sync of all NSE-listed companies in the background.
    Only one sync can run at a time. Requires authentication.
    """
    global _sync_running

    user = await _resolve_user(credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required to trigger batch sync.")

    async with _sync_lock:
        if _sync_running:
            return {
                "status": "already_running",
                "message": "A batch sync is already in progress. Check /api/market-data/sync-status for progress.",
            }
        _sync_running = True

    async def _run_and_unlock():
        global _sync_running
        try:
            await sync_all_symbols(batch_size=50, delay_seconds=1.0, years=10)
        finally:
            _sync_running = False

    background_tasks.add_task(_run_and_unlock)
    return {
        "status": "started",
        "message": "Batch sync started in the background. Check /api/market-data/sync-status for progress.",
    }


# ── Sync status ───────────────────────────────────────────────────────────────

@router.get("/market-data/sync-status")
async def get_sync_status():
    """Return the status of the most recent sync job."""
    status = await get_latest_sync_status()
    if not status:
        return {
            "status": "never_run",
            "message": "No sync has been run yet. POST /api/market-data/sync-all to start.",
        }
    return status

