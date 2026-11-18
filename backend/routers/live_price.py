"""
<<<<<<< HEAD
Live Price Router — Enhanced
==============================
GET  /api/live-price/{symbol}        → single NSE symbol price
GET  /api/live-price/batch           → multiple symbols (query: ?symbols=TCS,RELIANCE,...)
GET  /api/market-status              → current NSE market open/closed status
DELETE /api/live-price/cache/{symbol} → clear cached entry (testing/admin)
DELETE /api/live-price/cache          → clear all cached entries
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.live_price import (
    get_live_price,
    get_batch_prices,
    get_market_status,
    clear_cache,
    is_market_open,
)

logger = logging.getLogger("auditgpt.routers.live_price")
router = APIRouter()


@router.get("/market-status")
async def market_status():
    """
    Returns whether NSE is currently in its regular trading session (09:15–15:30 IST, Mon–Fri).
    Does not account for NSE public holidays.
    """
    return get_market_status()


@router.get("/live-price/batch")
@router.get("/live-price")
async def batch_live_price(
    symbols: str = Query(..., description="Comma-separated NSE symbols e.g. TCS,RELIANCE,WIPRO"),
):
    """
    Fetch live prices for multiple NSE symbols in a single request.
    Returns a dict keyed by symbol.
    Symbols for which data is unavailable are included with `available: false`.
    """
    raw = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not raw:
        raise HTTPException(status_code=400, detail="At least one symbol is required.")
    if len(raw) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 symbols per batch request.")

    logger.info("[live_price] Batch request for %d symbols: %s", len(raw), raw)
    results = get_batch_prices(raw)

    # Mark symbols with no data
    out = {}
    for sym in raw:
        d = results.get(sym)
        if d:
            out[sym] = d
        else:
            out[sym] = {"symbol": sym, "available": False, "data_type": "unavailable"}

    return {"results": out, "market_status": get_market_status()}


@router.get("/live-price/{symbol}")
async def live_price(symbol: str, refresh: bool = Query(False)):
    """
    Return the latest available price for an NSE-listed symbol.

    Data source priority:
      1. NSE India API (nseindia.com/api/quote-equity) — near-real-time during market hours.
      2. Yahoo Finance (.NS suffix) — last close price if NSE API is unreachable.

    The `data_type` field in the response tells you what kind of data you are receiving:
      - "near_real_time"   — NSE responded with a fresh price during market hours.
      - "latest_available" — NSE responded but market is currently closed.
      - "delayed"          — Serving from cache (within TTL window).
      - "fallback"         — NSE unreachable; sourced from Yahoo Finance (last close).

    IMPORTANT: This is NOT a WebSocket feed. Do not assume prices are tick-by-tick real-time.
    """
    sym = symbol.strip().upper()
    if not sym:
        raise HTTPException(status_code=400, detail="Symbol is required.")

    logger.info("[live_price] Request for symbol: %s", sym)

    data = get_live_price(sym, force_refresh=refresh)

    if not data:
        mkt = get_market_status()
        detail_msg = (
            f"Price data unavailable for '{sym}'. "
            f"Market status: {mkt['reason']} "
            "Verify the NSE symbol is correct (e.g. RELIANCE, TCS, HDFCBANK)."
        )
        logger.warning("[live_price] No data returned for %s", sym)
        raise HTTPException(status_code=503, detail=detail_msg)

    return data


@router.delete("/live-price/cache/{symbol}")
async def clear_symbol_cache(symbol: str):
    """Clear the cached price for a single symbol (useful for testing)."""
    clear_cache(symbol.upper())
    return {"cleared": symbol.upper(), "message": "Cache cleared for symbol."}


@router.delete("/live-price/cache")
async def clear_all_cache():
    """Clear the entire live-price cache (admin/testing)."""
    clear_cache()
    return {"cleared": "all", "message": "All live-price cache cleared."}
=======
Live Price Router — Fix 4
GET /live-price/{symbol}  →  real-time NSE price data
"""

from fastapi import APIRouter, HTTPException
from services.live_price import get_live_price, clear_cache

router = APIRouter()


@router.get("/live-price/{symbol}")
async def live_price(symbol: str):
    """
    Returns real-time price data for an NSE symbol.
    Data is cached for 15 minutes to avoid hammering NSE.

    Response fields:
      live_price, day_change, day_change_pct,
      day_high, day_low, week52_high, week52_low,
      volume, avg_volume, volume_ratio, volume_anomaly,
      circuit_up, circuit_down, last_updated, source
    """
    if not symbol or len(symbol.strip()) < 1:
        raise HTTPException(status_code=400, detail="Symbol is required")

    data = get_live_price(symbol.upper().strip())

    if not data:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Live price data unavailable for {symbol.upper()}. "
                "NSE may be closed or the symbol may not be listed."
            ),
        )

    return {"symbol": symbol.upper(), **data}


@router.delete("/live-price/cache/{symbol}")
async def clear_price_cache(symbol: str):
    """Clear cached price for a symbol (useful for testing)."""
    clear_cache(symbol.upper())
    return {"cleared": symbol.upper()}
>>>>>>> origin/main
