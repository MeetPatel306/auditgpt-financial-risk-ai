"""
Historical Price Service — AuditGPT
Fetches up to 10 years of daily OHLCV data from Yahoo Finance and stores it in
the MongoDB `price_history` collection using upsert to avoid duplicates.

Key design decisions
─────────────────────
• Uses an explicit start/end date range instead of a `period` string so we
  always request exactly 10 calendar years of data regardless of yfinance
  defaults.
• auto_adjust=True is passed to yfinance so the "Close" column is already
  split-/dividend-adjusted (no Adj Close column in that mode — Close IS
  adjusted).
• Bulk UpdateOne(upsert=True) with compound filter {"symbol", "date"} ensures
  exact deduplication without relying on application-level logic.
• Returns a typed summary dict so callers can display metadata without
  accessing MongoDB again.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import UpdateOne

from database import _CollectionProxy

logger = logging.getLogger("auditgpt.historical_price")

# Expose the collection so main.py can create the index at startup
price_history_collection = _CollectionProxy("price_history")

_YEARS = 10
_MAX_RECORDS = 365 * _YEARS + 10  # small buffer for leap years / trading calendar


def _build_yahoo_ticker(symbol: str) -> str:
    """Return the Yahoo Finance ticker for an NSE symbol."""
    sym = symbol.upper().strip()
    if sym.endswith(".NS") or sym.endswith(".BO"):
        return sym
    return f"{sym}.NS"


def _fetch_ohlcv(yahoo_ticker: str, start: date, end: date) -> pd.DataFrame:
    """
    Download OHLCV from Yahoo Finance.
    Returns an empty DataFrame on failure rather than raising.
    """
    try:
        ticker = yf.Ticker(yahoo_ticker)
        df = ticker.history(
            start=start.isoformat(),
            end=end.isoformat(),
            interval="1d",
            auto_adjust=True,    # Close = adjusted close
            back_adjust=False,
            prepost=False,
            actions=False,       # skip dividends / splits columns
        )
        return df
    except Exception as exc:
        logger.warning("yfinance download failed for %s: %s", yahoo_ticker, exc)
        return pd.DataFrame()


def _normalise(df: pd.DataFrame, symbol: str) -> list[dict]:
    """
    Convert a yfinance DataFrame into a list of MongoDB documents.
    Each document has: symbol, date (ISO-8601 string), open, high, low,
    close (adjusted), volume.
    """
    if df.empty:
        return []

    records: list[dict] = []
    for ts, row in df.iterrows():
        # ts is a pandas Timestamp (timezone-aware from yfinance)
        dt = ts.date() if hasattr(ts, "date") else pd.Timestamp(ts).date()
        doc = {
            "symbol": symbol.upper(),
            "date": dt.isoformat(),            # "YYYY-MM-DD"
            "open": _safe_float(row.get("Open")),
            "high": _safe_float(row.get("High")),
            "low": _safe_float(row.get("Low")),
            "close": _safe_float(row.get("Close")),
            "volume": _safe_int(row.get("Volume")),
        }
        records.append(doc)
    return records


def _safe_float(val) -> Optional[float]:
    try:
        f = float(val)
        return None if pd.isna(f) else round(f, 4)
    except Exception:
        return None


def _safe_int(val) -> Optional[int]:
    try:
        return int(val)
    except Exception:
        return None


async def fetch_and_store_history(
    symbol: str,
    years: int = _YEARS,
    collection: Optional[AsyncIOMotorCollection] = None,
) -> dict:
    """
    Fetch up to `years` years of daily OHLCV for `symbol` from Yahoo Finance
    and upsert into MongoDB.

    Returns a summary dict:
    {
        "symbol": str,
        "yahoo_ticker": str,
        "records_upserted": int,
        "start_date": str | None,
        "end_date": str | None,
        "years_available": float,
        "success": bool,
        "error": str | None,
    }
    """
    col = collection or price_history_collection

    yahoo_ticker = _build_yahoo_ticker(symbol)
    today = date.today()
    start = today - timedelta(days=365 * years + 5)   # +5 days buffer
    end = today + timedelta(days=1)                    # yfinance end is exclusive

    logger.info("Fetching %d-year history for %s (%s)", years, symbol, yahoo_ticker)

    df = _fetch_ohlcv(yahoo_ticker, start, end)

    if df.empty:
        logger.warning("No data returned for %s", yahoo_ticker)
        return {
            "symbol": symbol.upper(),
            "yahoo_ticker": yahoo_ticker,
            "records_upserted": 0,
            "start_date": None,
            "end_date": None,
            "years_available": 0.0,
            "success": False,
            "error": "No data returned from Yahoo Finance",
        }

    records = _normalise(df, symbol)
    if not records:
        return {
            "symbol": symbol.upper(),
            "yahoo_ticker": yahoo_ticker,
            "records_upserted": 0,
            "start_date": None,
            "end_date": None,
            "years_available": 0.0,
            "success": False,
            "error": "Data normalisation produced no records",
        }

    # Upsert — filter on (symbol, date) which has a unique compound index
    ops = [
        UpdateOne(
            {"symbol": r["symbol"], "date": r["date"]},
            {"$set": r},
            upsert=True,
        )
        for r in records
    ]

    try:
        result = await col.bulk_write(ops, ordered=False)
        upserted = result.upserted_count + result.modified_count
    except Exception as exc:
        logger.error("MongoDB bulk_write failed for %s: %s", symbol, exc)
        return {
            "symbol": symbol.upper(),
            "yahoo_ticker": yahoo_ticker,
            "records_upserted": 0,
            "start_date": None,
            "end_date": None,
            "years_available": 0.0,
            "success": False,
            "error": str(exc),
        }

    dates = sorted(r["date"] for r in records)
    start_date = dates[0]
    end_date = dates[-1]

    # Approximate number of calendar years covered
    try:
        s = date.fromisoformat(start_date)
        e = date.fromisoformat(end_date)
        years_available = round((e - s).days / 365.25, 1)
    except Exception:
        years_available = 0.0

    logger.info(
        "%s: upserted %d records (%s → %s, %.1f years)",
        symbol, upserted, start_date, end_date, years_available,
    )

    return {
        "symbol": symbol.upper(),
        "yahoo_ticker": yahoo_ticker,
        "records_upserted": upserted,
        "start_date": start_date,
        "end_date": end_date,
        "years_available": years_available,
        "success": True,
        "error": None,
    }


async def get_stored_history(
    symbol: str,
    limit: int = 3650,
    collection: Optional[AsyncIOMotorCollection] = None,
) -> list[dict]:
    """
    Return stored OHLCV records for `symbol` from MongoDB, newest first,
    up to `limit` records.
    """
    col = collection or price_history_collection
    cursor = col.find(
        {"symbol": symbol.upper()},
        {"_id": 0},
        sort=[("date", -1)],
        limit=limit,
    )
    docs = await cursor.to_list(length=limit)
    # Return in ascending date order for charting
    return list(reversed(docs))


async def get_history_meta(
    symbol: str,
    collection: Optional[AsyncIOMotorCollection] = None,
) -> dict:
    """
    Return metadata about what is stored without sending all OHLCV records.
    """
    col = collection or price_history_collection
    count = await col.count_documents({"symbol": symbol.upper()})
    if count == 0:
        return {"symbol": symbol.upper(), "count": 0, "start_date": None, "end_date": None}

    oldest = await col.find_one({"symbol": symbol.upper()}, {"date": 1, "_id": 0}, sort=[("date", 1)])
    newest = await col.find_one({"symbol": symbol.upper()}, {"date": 1, "_id": 0}, sort=[("date", -1)])
    return {
        "symbol": symbol.upper(),
        "count": count,
        "start_date": oldest["date"] if oldest else None,
        "end_date": newest["date"] if newest else None,
    }

