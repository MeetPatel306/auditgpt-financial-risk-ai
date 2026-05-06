"""
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