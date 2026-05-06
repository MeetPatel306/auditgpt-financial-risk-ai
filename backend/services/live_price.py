"""
Live Price Service — Fix 4
Fetches real-time NSE price data with 15-min module-level cache.
"""

from __future__ import annotations
import requests
from datetime import datetime, timedelta

# ── Module-level cache: { symbol: { data: dict, fetched_at: datetime } } ─────
_price_cache: dict[str, dict] = {}
_CACHE_TTL = timedelta(minutes=15)

_NSE_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://www.nseindia.com/",
    "Connection":      "keep-alive",
}


def _safe(val):
    """Safely convert a value to float, returning None on failure."""
    if val is None:
        return None
    try:
        f = float(val)
        import math
        return None if math.isnan(f) else round(f, 2)
    except (TypeError, ValueError):
        return None


def _fetch_from_nse(symbol: str) -> dict:
    """
    Hit NSE equity quote API.
    Returns raw parsed dict or empty dict on failure.
    """
    try:
        session = requests.Session()
        # Warm up cookies
        session.get("https://www.nseindia.com", headers=_NSE_HEADERS, timeout=6)

        url  = f"https://www.nseindia.com/api/quote-equity?symbol={symbol.upper()}"
        resp = session.get(url, headers=_NSE_HEADERS, timeout=6)

        if resp.status_code != 200:
            return {}

        raw        = resp.json()
        price_info = raw.get("priceInfo", {})
        metadata   = raw.get("metadata",  {})
        trade_info = raw.get("tradeInfo", {})

        live_price   = _safe(price_info.get("lastPrice"))
        day_change   = _safe(price_info.get("change"))
        day_pct      = _safe(price_info.get("pChange"))
        day_high     = _safe((price_info.get("intraDayHighLow") or {}).get("max"))
        day_low      = _safe((price_info.get("intraDayHighLow") or {}).get("min"))
        week52_high  = _safe((price_info.get("weekHighLow") or {}).get("max"))
        week52_low   = _safe((price_info.get("weekHighLow") or {}).get("min"))
        volume       = _safe(trade_info.get("totalTradedVolume") or metadata.get("totalTradedVolume"))
        avg_volume   = _safe(trade_info.get("cmAdjHighLow", {}).get("value") if isinstance(trade_info.get("cmAdjHighLow"), dict) else None)
        circuit_up   = _safe((price_info.get("upperCP") or "").replace(",", "") if isinstance(price_info.get("upperCP"), str) else price_info.get("upperCP"))
        circuit_down = _safe((price_info.get("lowerCP") or "").replace(",", "") if isinstance(price_info.get("lowerCP"), str) else price_info.get("lowerCP"))

        # Volume anomaly
        volume_ratio   = None
        volume_anomaly = False
        if volume and avg_volume and avg_volume > 0:
            volume_ratio   = round(volume / avg_volume, 2)
            volume_anomaly = volume_ratio >= 3.0

        return {
            "live_price":      live_price,
            "day_change":      day_change,
            "day_change_pct":  day_pct,
            "day_high":        day_high,
            "day_low":         day_low,
            "week52_high":     week52_high,
            "week52_low":      week52_low,
            "volume":          volume,
            "avg_volume":      avg_volume,
            "volume_ratio":    volume_ratio,
            "volume_anomaly":  volume_anomaly,
            "circuit_up":      circuit_up,
            "circuit_down":    circuit_down,
            "last_updated":    datetime.utcnow().isoformat(),
            "source":          "NSE",
        }

    except Exception as e:
        print(f"[live_price] NSE fetch failed for {symbol}: {e}")
        return {}


def get_live_price(symbol: str) -> dict:
    """
    Public function — returns live price data with 15-min cache.
    Returns empty dict if NSE is unreachable.
    """
    symbol = symbol.upper().strip()
    now    = datetime.utcnow()

    # Check cache
    cached = _price_cache.get(symbol)
    if cached and (now - cached["fetched_at"]) < _CACHE_TTL:
        return cached["data"]

    # Fetch fresh
    data = _fetch_from_nse(symbol)

    if data:
        _price_cache[symbol] = {"data": data, "fetched_at": now}

    return data


def clear_cache(symbol: str | None = None):
    """Clear cache for a specific symbol or all symbols."""
    if symbol:
        _price_cache.pop(symbol.upper(), None)
    else:
        _price_cache.clear()