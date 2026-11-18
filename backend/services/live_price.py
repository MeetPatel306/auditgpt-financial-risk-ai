"""
<<<<<<< HEAD
Live Price Service — Enhanced
==============================
Fetches near-real-time NSE price data for Indian stocks.

Data source hierarchy:
  1. NSE India unofficial API (nseindia.com/api/quote-equity)
     → returns latest traded price, typically updated every few minutes during market hours.
     → NOT a WebSocket feed; prices are delayed by whatever the NSE web API provides.
     → NOTE: NSE website blocks server-side Python requests with HTTP 403 (WAF/Cloudflare block).
       When this happens the error is classified as NSE_PROVIDER_BLOCKED and yfinance is used.
  2. yfinance fallback (Yahoo Finance .NS suffix)
     → returns the last available price (last_price from fast_info, which is the most recent
       available price — may be the last traded price or the previous session's close).

Accuracy label returned in every response:
  "near_real_time"     — NSE API responded successfully during market hours.
  "latest_available"   — NSE responded but market is currently closed (data is session end price).
  "delayed"            — Serving from cache (within TTL window).
  "last_close"         — NSE API failed; price sourced from yfinance (most recent available price).
  "unavailable"        — Both sources failed.

price_status field (used for UI labeling — more specific than data_type):
  "LIVE" (near_real_time from NSE)
  "LAST TRADED PRICE" (latest_available from NSE after market close)
  "LAST AVAILABLE" (yfinance, market open but NSE blocked)
  "PREVIOUS CLOSE" (yfinance, market closed)
  "CACHED" (served from cache)
  "UNAVAILABLE"

IMPORTANT: This application does NOT have a real-time WebSocket feed.
Do NOT claim prices are "real-time" in any UI label.
"""

from __future__ import annotations

import logging
import math
import os
import threading
from datetime import datetime, timedelta, time as dtime
from typing import Optional

import requests
import yfinance as yf

logger = logging.getLogger("auditgpt.live_price")

# ── Cache ──────────────────────────────────────────────────────────────────────
_price_cache: dict[str, dict] = {}
_CACHE_TTL_MARKET_OPEN  = timedelta(minutes=3)
_CACHE_TTL_MARKET_CLOSED = timedelta(minutes=60)
_FAILURE_TTL = timedelta(seconds=45)
_NSE_BLOCK_COOLDOWN = timedelta(minutes=int(os.getenv("NSE_BLOCK_COOLDOWN_MINUTES", "30")))
_PRIMARY_PROVIDER = os.getenv("MARKET_DATA_PRIMARY_PROVIDER", "nse").strip().lower()
_nse_blocked_until: datetime | None = None
_inflight: dict[str, threading.Event] = {}
_inflight_guard = threading.Lock()
_cache_lock = threading.Lock()

# ── NSE request headers ────────────────────────────────────────────────────────
_NSE_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer":         "https://www.nseindia.com/",
    "Connection":      "keep-alive",
    "sec-fetch-dest":  "empty",
    "sec-fetch-mode":  "cors",
    "sec-fetch-site":  "same-origin",
}

# NSE session timeout (seconds)
_NSE_TIMEOUT = int(os.getenv("NSE_REQUEST_TIMEOUT", "8"))


# ── Market hours (IST = UTC+5:30) ─────────────────────────────────────────────
_IST_OFFSET = timedelta(hours=5, minutes=30)

def _now_ist() -> datetime:
    return datetime.utcnow() + _IST_OFFSET

def is_market_open() -> bool:
    """
    Returns True if NSE is currently in its regular trading session.
    NSE hours: Mon–Fri 09:15–15:30 IST.
    Does NOT account for NSE holidays (not feasible without a live calendar).
    """
    now_ist = _now_ist()
    if now_ist.weekday() >= 5:          # Saturday (5) or Sunday (6)
        return False
    t = now_ist.time()
    return dtime(9, 15) <= t <= dtime(15, 30)

def get_market_status() -> dict:
    """Returns a dict describing current NSE market status."""
    now_ist = _now_ist()
    open_ = is_market_open()
    t = now_ist.time()
    if now_ist.weekday() >= 5:
        reason = "Weekend — NSE is closed on Saturday and Sunday."
    elif t < dtime(9, 15):
        reason = f"Pre-market — NSE opens at 09:15 IST. Current IST: {t.strftime('%H:%M')}."
    elif t > dtime(15, 30):
        reason = f"Post-market — NSE closed at 15:30 IST. Current IST: {t.strftime('%H:%M')}."
    else:
        reason = f"Market is OPEN. NSE session: 09:15–15:30 IST. Current IST: {t.strftime('%H:%M')}."
    return {
        "is_open": open_,
        "ist_time": now_ist.strftime("%Y-%m-%dT%H:%M:%S"),
        "reason": reason,
    }


# ── Helpers ────────────────────────────────────────────────────────────────────
def _safe(val) -> Optional[float]:
    """Convert a value to float, returning None on failure or NaN."""
    if val is None:
        return None
    try:
        f = float(str(val).replace(",", ""))
        return None if math.isnan(f) or math.isinf(f) else round(f, 2)
=======
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
>>>>>>> origin/main
    except (TypeError, ValueError):
        return None


<<<<<<< HEAD
def _freshness_label(fetched_at: datetime, from_cache: bool) -> str:
    """Return a human-readable data freshness label."""
    if is_market_open():
        return "delayed" if from_cache else "near_real_time"
    return "latest_available"


# ── NSE Provider Error Codes ───────────────────────────────────────────────────
NSE_ERROR_BLOCKED        = "NSE_PROVIDER_BLOCKED"       # HTTP 403 — WAF/Cloudflare block
NSE_ERROR_AUTH           = "NSE_PROVIDER_AUTH_ERROR"    # HTTP 401 — session/auth failure
NSE_ERROR_NOT_LISTED     = "INVALID_SYMBOL"             # HTTP 404 — symbol not on NSE
NSE_ERROR_RATE_LIMIT     = "NSE_PROVIDER_RATE_LIMIT"    # HTTP 429
NSE_ERROR_UNAVAILABLE    = "NSE_PROVIDER_UNAVAILABLE"   # HTTP 5xx
NSE_ERROR_TIMEOUT        = "NSE_PROVIDER_TIMEOUT"       # Timeout
NSE_ERROR_CONNECTION     = "NSE_PROVIDER_CONNECTION_ERROR"
NSE_ERROR_EMPTY_RESPONSE = "EMPTY_PROVIDER_RESPONSE"   # 200 but no price
NSE_ERROR_PARSE          = "RESPONSE_PARSE_ERROR"       # JSON parse failure


# ── NSE Primary Source ─────────────────────────────────────────────────────────
def _fetch_from_nse(symbol: str) -> dict:
    """
    Fetch price data from NSE India's equity quote API.
    NSE requires a valid session cookie — we warm up by hitting the homepage first.

    KNOWN ISSUE: NSE website blocks server-side Python requests with HTTP 403
    due to Cloudflare/WAF protection on their infrastructure. This is a
    network/IP-level block, not an authentication failure. The error is
    classified as NSE_PROVIDER_BLOCKED and the caller will use yfinance fallback.

    Returns a normalized price dict or empty dict on failure.
    Sets '_nse_error_code' key when a specific error can be classified.
    """
    session = requests.Session()
    try:
        # Cookie warm-up — NSE rejects requests without a prior homepage visit
        warm_resp = session.get(
            "https://www.nseindia.com",
            headers=_NSE_HEADERS,
            timeout=_NSE_TIMEOUT,
        )

        # If the warm-up itself is blocked, skip the API call immediately
        if warm_resp.status_code == 403:
            logger.warning(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: BLOCKED | "
                "HTTP Status: 403 | Reason: WAF/Cloudflare server-side IP block. "
                "Switching to fallback provider without retrying the blocked endpoint.",
                symbol,
            )
            return {"_nse_error_code": NSE_ERROR_BLOCKED}

        url = f"https://www.nseindia.com/api/quote-equity?symbol={symbol.upper()}"
        resp = session.get(url, headers=_NSE_HEADERS, timeout=_NSE_TIMEOUT)

        if resp.status_code == 401:
            logger.warning(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: FAILED | "
                "HTTP Status: 401 | Reason: Session/authentication failure.",
                symbol,
            )
            return {"_nse_error_code": NSE_ERROR_AUTH}

        if resp.status_code == 403:
            logger.warning(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: BLOCKED | "
                "HTTP Status: 403 | Reason: WAF/Cloudflare server-side IP block.",
                symbol,
            )
            return {"_nse_error_code": NSE_ERROR_BLOCKED}

        if resp.status_code == 404:
            logger.info(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: NOT_LISTED | "
                "HTTP Status: 404 | Reason: Symbol not listed on NSE.",
                symbol,
            )
            return {"_not_listed": True, "_nse_error_code": NSE_ERROR_NOT_LISTED}

        if resp.status_code == 429:
            logger.warning(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: RATE_LIMITED | "
                "HTTP Status: 429 | Reason: Too many requests.",
                symbol,
            )
            return {"_nse_error_code": NSE_ERROR_RATE_LIMIT}

        if resp.status_code >= 500:
            logger.warning(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: SERVER_ERROR | "
                "HTTP Status: %d | Reason: NSE server-side error.",
                symbol, resp.status_code,
            )
            return {"_nse_error_code": NSE_ERROR_UNAVAILABLE}

        if resp.status_code != 200:
            logger.warning(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: FAILED | "
                "HTTP Status: %d",
                symbol, resp.status_code,
            )
            return {"_nse_error_code": NSE_ERROR_UNAVAILABLE}

        try:
            raw = resp.json()
        except Exception:
            logger.error(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: PARSE_ERROR | "
                "Reason: Response body is not valid JSON.",
                symbol,
            )
            return {"_nse_error_code": NSE_ERROR_PARSE}

        price_info = raw.get("priceInfo") or {}
        metadata   = raw.get("metadata")  or {}
        trade_info = raw.get("tradeInfo")  or {}
=======
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
>>>>>>> origin/main

        live_price   = _safe(price_info.get("lastPrice"))
        day_change   = _safe(price_info.get("change"))
        day_pct      = _safe(price_info.get("pChange"))
<<<<<<< HEAD
        prev_close   = _safe(price_info.get("previousClose") or price_info.get("close"))
        open_price   = _safe(price_info.get("open"))
=======
>>>>>>> origin/main
        day_high     = _safe((price_info.get("intraDayHighLow") or {}).get("max"))
        day_low      = _safe((price_info.get("intraDayHighLow") or {}).get("min"))
        week52_high  = _safe((price_info.get("weekHighLow") or {}).get("max"))
        week52_low   = _safe((price_info.get("weekHighLow") or {}).get("min"))
<<<<<<< HEAD
        volume       = _safe(
            trade_info.get("totalTradedVolume") or metadata.get("totalTradedVolume")
        )
        circuit_up   = _safe(
            price_info.get("upperCP", "").replace(",", "")
            if isinstance(price_info.get("upperCP"), str)
            else price_info.get("upperCP")
        )
        circuit_down = _safe(
            price_info.get("lowerCP", "").replace(",", "")
            if isinstance(price_info.get("lowerCP"), str)
            else price_info.get("lowerCP")
        )

        # Company name from metadata
        company_name = (
            metadata.get("companyName")
            or metadata.get("symbol")
            or symbol.upper()
        )

        if live_price is None:
            logger.warning(
                "[live_price] NSE | Provider: NSE | Symbol: %s | Status: EMPTY_RESPONSE | "
                "Reason: 200 OK but priceInfo.lastPrice is missing/null.",
                symbol,
            )
            return {"_nse_error_code": NSE_ERROR_EMPTY_RESPONSE}

        # Volume anomaly detection
        avg_volume     = _safe(trade_info.get("totalTradedValue"))  # best available proxy
=======
        volume       = _safe(trade_info.get("totalTradedVolume") or metadata.get("totalTradedVolume"))
        avg_volume   = _safe(trade_info.get("cmAdjHighLow", {}).get("value") if isinstance(trade_info.get("cmAdjHighLow"), dict) else None)
        circuit_up   = _safe((price_info.get("upperCP") or "").replace(",", "") if isinstance(price_info.get("upperCP"), str) else price_info.get("upperCP"))
        circuit_down = _safe((price_info.get("lowerCP") or "").replace(",", "") if isinstance(price_info.get("lowerCP"), str) else price_info.get("lowerCP"))

        # Volume anomaly
>>>>>>> origin/main
        volume_ratio   = None
        volume_anomaly = False
        if volume and avg_volume and avg_volume > 0:
            volume_ratio   = round(volume / avg_volume, 2)
            volume_anomaly = volume_ratio >= 3.0

<<<<<<< HEAD
        mkt_open = is_market_open()
        data_type = "near_real_time" if mkt_open else "latest_available"
        # price_status is a human-friendly label for the UI
        price_status = "LIVE" if mkt_open else "LAST TRADED PRICE"

        logger.info(
            "[live_price] NSE | Provider: NSE | Symbol: %s | Status: SUCCESS | "
            "Data: Available | Market State: %s",
            symbol, "OPEN" if mkt_open else "CLOSED",
        )

        return {
            "symbol":         symbol.upper(),
            "company_name":   company_name,
            "live_price":     live_price,
            "prev_close":     prev_close,
            "open":           open_price,
            "day_change":     day_change,
            "day_change_pct": day_pct,
            "day_high":       day_high,
            "day_low":        day_low,
            "week52_high":    week52_high,
            "week52_low":     week52_low,
            "volume":         volume,
            "volume_ratio":   volume_ratio,
            "volume_anomaly": volume_anomaly,
            "circuit_up":     circuit_up,
            "circuit_down":   circuit_down,
            "source":         "NSE",
            "data_type":      data_type,
            "price_status":   price_status,
            "last_updated":   datetime.utcnow().isoformat() + "Z",
            "market_status":  get_market_status(),
        }

    except requests.exceptions.Timeout:
        logger.error(
            "[live_price] NSE | Provider: NSE | Symbol: %s | Status: FAILED | "
            "HTTP Status: TIMEOUT | Reason: Request timed out after %ds.",
            symbol, _NSE_TIMEOUT,
        )
        return {"_nse_error_code": NSE_ERROR_TIMEOUT}
    except requests.exceptions.ConnectionError as exc:
        logger.error(
            "[live_price] NSE | Provider: NSE | Symbol: %s | Status: FAILED | "
            "Reason: Connection error — %s",
            symbol, str(exc)[:100],
        )
        return {"_nse_error_code": NSE_ERROR_CONNECTION}
    except Exception as exc:
        logger.error(
            "[live_price] NSE | Provider: NSE | Symbol: %s | Status: FAILED | "
            "Reason: Unexpected error — %s",
            symbol, str(exc)[:100], exc_info=True,
        )
        return {}
    finally:
        session.close()


# ── yfinance Fallback ──────────────────────────────────────────────────────────
def _fetch_from_yfinance(symbol: str, nse_error_code: str = "") -> dict:
    """
    Fallback: fetch latest price from Yahoo Finance (.NS suffix).

    yfinance fast_info.last_price: most recent available price from Yahoo's feed.
    This may be the current intraday price (if the market is open and Yahoo has
    updated data) or the previous session's close (if market is closed or data
    hasn't updated yet). We never label it as 'LIVE' — it is at best 'LAST AVAILABLE'.
    """
    mkt_open = is_market_open()
    try:
        ticker    = yf.Ticker(f"{symbol.upper()}.NS")
        fi        = ticker.fast_info  # lightweight endpoint
        last_price  = _safe(getattr(fi, "last_price", None))
        prev_close  = _safe(getattr(fi, "previous_close", None))
        open_price  = _safe(getattr(fi, "open", None))
        day_high    = _safe(getattr(fi, "day_high", None))
        day_low     = _safe(getattr(fi, "day_low", None))
        week52_high = _safe(getattr(fi, "year_high", None))
        week52_low  = _safe(getattr(fi, "year_low", None))
        # Use last_volume (today's actual volume) if available, fall back to 3-month average
        volume      = _safe(getattr(fi, "last_volume", None)) or _safe(getattr(fi, "three_month_average_volume", None))
        company_name = symbol.upper()

        price = last_price
        if price is None:
            price = prev_close

        if price is None:
            # Last resort: full .info dict (heavier call)
            full_info    = ticker.info or {}
            price        = _safe(full_info.get("currentPrice") or full_info.get("regularMarketPrice"))
            prev_close   = _safe(full_info.get("previousClose"))
            company_name = full_info.get("longName") or full_info.get("shortName") or symbol.upper()

        if price is None:
            logger.warning(
                "[live_price] Yahoo Finance | Provider: Yahoo Finance | Symbol: %s.NS | "
                "Status: FAILED | Reason: No price available from fast_info or .info.",
                symbol,
            )
            return {}

        day_change = None
        day_pct    = None
        if price is not None and prev_close and prev_close > 0:
            day_change = round(price - prev_close, 2)
            day_pct    = round((day_change / prev_close) * 100, 2)

        # Determine price_status accurately:
        # yfinance last_price is the most recently available price from Yahoo's feed.
        # It is NOT guaranteed to be real-time; it reflects Yahoo Finance's update cadence.
        # When the market is open it is likely the current price (15-min delayed by Yahoo).
        # When the market is closed it is the previous session's last traded price.
        if mkt_open:
            price_status = "LAST AVAILABLE"
            data_type    = "last_close"  # best we can do without NSE — avoid 'fallback' which sounds broken
        else:
            price_status = "PREVIOUS CLOSE"
            data_type    = "last_close"

        # Build a meaningful fallback note based on WHY NSE failed
        if nse_error_code == NSE_ERROR_BLOCKED:
            fallback_reason = (
                "Primary market-data provider (NSE) is temporarily unavailable due to a "
                "server-side access restriction. Showing the latest available data from "
                "Yahoo Finance. Price accuracy: " + ("~15 min delayed." if mkt_open else "previous session close.")
            )
        elif nse_error_code == NSE_ERROR_TIMEOUT:
            fallback_reason = (
                "NSE data provider timed out. Showing latest available price from Yahoo Finance."
            )
        elif nse_error_code == NSE_ERROR_RATE_LIMIT:
            fallback_reason = (
                "NSE data provider rate limit reached. Showing latest available price from Yahoo Finance."
            )
        else:
            fallback_reason = (
                "NSE data provider unavailable. Showing latest available price from Yahoo Finance "
                "(" + ("~15 min delayed" if mkt_open else "previous session close") + ")."
            )

        logger.info(
            "[live_price] Yahoo Finance | Provider: Yahoo Finance | Symbol: %s.NS | "
            "Status: SUCCESS | Data: Available | Market State: %s | price_status: %s",
            symbol, "OPEN" if mkt_open else "CLOSED", price_status,
        )

        return {
            "symbol":         symbol.upper(),
            "company_name":   company_name,
            "live_price":     price,
            "prev_close":     prev_close,
            "open":           open_price,
            "day_change":     day_change,
            "day_change_pct": day_pct,
            "day_high":       day_high,
            "day_low":        day_low,
            "week52_high":    week52_high,
            "week52_low":     week52_low,
            "volume":         volume,
            "volume_ratio":   None,
            "volume_anomaly": False,
            "circuit_up":     None,
            "circuit_down":   None,
            "source":         "Yahoo Finance (.NS)",
            "data_type":      data_type,
            "price_status":   price_status,
            "last_updated":   datetime.utcnow().isoformat() + "Z",
            "market_status":  get_market_status(),
            "fallback_note":  fallback_reason,
            "nse_error_code": nse_error_code or "NSE_PROVIDER_UNAVAILABLE",
        }
    except Exception as exc:
        logger.error(
            "[live_price] Yahoo Finance | Provider: Yahoo Finance | Symbol: %s.NS | "
            "Status: FAILED | Reason: %s",
            symbol, str(exc)[:100], exc_info=True,
        )
        return {}


# ── Public API ─────────────────────────────────────────────────────────────────
def _mark_nse_blocked() -> None:
    global _nse_blocked_until
    _nse_blocked_until = datetime.utcnow() + _NSE_BLOCK_COOLDOWN


def _nse_is_cooled_down() -> bool:
    return _nse_blocked_until is not None and datetime.utcnow() < _nse_blocked_until


def _store_cache(symbol: str, data: dict, *, success: bool) -> None:
    with _cache_lock:
        _price_cache[symbol] = {
            "data": data,
            "fetched_at": datetime.utcnow(),
            "success": success,
        }


def get_live_price(symbol: str, force_refresh: bool = False) -> dict:
    """
    Return live/latest price data for an NSE symbol.

    Primary: NSE (skipped while a WAF block cooldown is active).
    Fallback: Yahoo Finance .NS
    Failed responses are cached only briefly and never treated as successful quotes.
    """
    symbol = symbol.upper().strip()
    now    = datetime.utcnow()
    ttl    = _CACHE_TTL_MARKET_OPEN if is_market_open() else _CACHE_TTL_MARKET_CLOSED

    if not force_refresh:
        cached = _price_cache.get(symbol)
        if cached:
            age = now - cached["fetched_at"]
            allowed = ttl if cached.get("success", True) else _FAILURE_TTL
            if age < allowed:
                data = dict(cached["data"])
                if cached.get("success") and is_market_open():
                    data["data_type"] = "delayed"
                    data["price_status"] = "CACHED"
                data["cache_age_s"] = int(age.total_seconds())
                return data

    with _inflight_guard:
        waiter = _inflight.get(symbol)
        is_leader = waiter is None
        if is_leader:
            waiter = threading.Event()
            _inflight[symbol] = waiter
    if not is_leader:
        waiter.wait(timeout=20)
        cached = _price_cache.get(symbol)
        return dict(cached["data"]) if cached else {}

    try:
        nse_data: dict = {}
        nse_error_code = ""
        skip_nse = _PRIMARY_PROVIDER == "yahoo" or _nse_is_cooled_down()
        if skip_nse:
            nse_error_code = NSE_ERROR_BLOCKED if _nse_is_cooled_down() else ""
            logger.info(
                "[live_price] Skipping NSE for %s (primary=%s, cooldown=%s)",
                symbol, _PRIMARY_PROVIDER, bool(_nse_is_cooled_down()),
            )
        else:
            nse_data = _fetch_from_nse(symbol)
            nse_error_code = nse_data.get("_nse_error_code", "") if nse_data else ""
            if nse_error_code == NSE_ERROR_BLOCKED:
                _mark_nse_blocked()

        if nse_data and not nse_data.get("_nse_error_code") and not nse_data.get("_not_listed"):
            _store_cache(symbol, nse_data, success=True)
            return nse_data

        if nse_data.get("_not_listed"):
            unavailable = {
                "symbol": symbol,
                "data_type": "unavailable",
                "price_status": "UNAVAILABLE",
                "nse_error_code": NSE_ERROR_NOT_LISTED,
                "message": f"Symbol '{symbol}' is not listed on NSE.",
            }
            _store_cache(symbol, unavailable, success=False)
            return unavailable

        logger.info(
            "[live_price] NSE unavailable for %s (error: %s) — using Yahoo Finance fallback",
            symbol, nse_error_code or "unknown",
        )
        data = _fetch_from_yfinance(symbol, nse_error_code=nse_error_code)
        if data:
            _store_cache(symbol, data, success=True)
            return data

        logger.error(
            "[live_price] NO_MARKET_DATA | Both NSE and Yahoo Finance failed for symbol: %s",
            symbol,
        )
        empty = {
            "symbol": symbol,
            "data_type": "unavailable",
            "price_status": "UNAVAILABLE",
            "nse_error_code": nse_error_code or NSE_ERROR_UNAVAILABLE,
            "message": f"No market quote is currently available for {symbol}.",
        }
        _store_cache(symbol, empty, success=False)
        return empty
    finally:
        waiter.set()
        with _inflight_guard:
            _inflight.pop(symbol, None)


def get_batch_prices(symbols: list[str]) -> dict[str, dict]:
    """Fetch prices for multiple symbols. Each is fetched independently (NSE has no batch API)."""
    return {s: get_live_price(s) for s in symbols}


def clear_cache(symbol: str | None = None) -> None:
    """Clear cached price data for one symbol or all symbols."""
    global _nse_blocked_until
    with _cache_lock:
        if symbol:
            _price_cache.pop(symbol.upper(), None)
        else:
            _price_cache.clear()
            _nse_blocked_until = None


def reset_nse_block_for_tests() -> None:
    global _nse_blocked_until
    _nse_blocked_until = None
=======
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
>>>>>>> origin/main
