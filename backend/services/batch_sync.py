"""
Batch Sync Service — AuditGPT
Downloads 10 years of OHLCV history for every NSE-listed company and stores
the results in MongoDB.

Design
──────
• Loads the company list from nse_companies.json (1,398 symbols) plus the
  SPECIAL_ENTITIES from symbol_resolver (TMCV, TMPV, etc.).
• Processes symbols in configurable batches with a rate-limit delay between
  batches to respect Yahoo Finance's unofficial limits.
• Each attempt uses 3 retries with exponential back-off.
• A `sync_jobs` MongoDB collection tracks overall progress so a /sync-all call
  can be resumed if interrupted.
• `sync_symbol()` can be called independently for a single-symbol on-demand
  refresh.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from database import _CollectionProxy
from services.historical_price import fetch_and_store_history
from services.symbol_resolver import SPECIAL_ENTITIES

logger = logging.getLogger("auditgpt.batch_sync")

sync_jobs_collection = _CollectionProxy("sync_jobs")

_NSE_JSON = Path(__file__).resolve().parent.parent / "nse_companies.json"

_DEFAULT_BATCH_SIZE = 50
_DEFAULT_DELAY_SECONDS = 1.0
_MAX_RETRIES = 3
_RETRY_BACKOFF = [1, 3, 7]   # seconds to sleep between retries


# ── Symbol loading ─────────────────────────────────────────────────────────────

def load_all_symbols() -> list[str]:
    """
    Return a deduplicated list of all NSE symbols from nse_companies.json
    merged with SPECIAL_ENTITIES (e.g. TMCV, TMPV).
    """
    symbols: list[str] = []
    seen: set[str] = set()

    # From the JSON file
    if _NSE_JSON.exists():
        try:
            with open(_NSE_JSON, "r", encoding="utf-8") as fh:
                companies = json.load(fh)
            for c in companies:
                sym = (c.get("symbol") or "").upper().strip()
                if sym and sym not in seen:
                    seen.add(sym)
                    symbols.append(sym)
        except Exception as exc:
            logger.error("Failed to load nse_companies.json: %s", exc)

    # Merge special entities
    for sym in SPECIAL_ENTITIES:
        sym_u = sym.upper()
        if sym_u not in seen:
            seen.add(sym_u)
            symbols.append(sym_u)

    logger.info("Loaded %d unique NSE symbols for batch sync", len(symbols))
    return symbols


# ── Single-symbol sync ─────────────────────────────────────────────────────────

async def sync_symbol(
    symbol: str,
    years: int = 10,
    retries: int = _MAX_RETRIES,
) -> dict:
    """
    Sync one symbol with retries.  Returns the fetch_and_store_history summary
    dict augmented with retry metadata.
    """
    result: dict = {"symbol": symbol, "success": False, "error": None}
    for attempt in range(retries):
        try:
            result = await fetch_and_store_history(symbol, years=years)
            if result["success"]:
                return result
            # Non-exception failure (empty data) — no point retrying
            return result
        except Exception as exc:
            wait = _RETRY_BACKOFF[min(attempt, len(_RETRY_BACKOFF) - 1)]
            logger.warning(
                "sync_symbol %s attempt %d/%d failed: %s — retrying in %ds",
                symbol, attempt + 1, retries, exc, wait,
            )
            if attempt < retries - 1:
                await asyncio.sleep(wait)
            else:
                result = {
                    "symbol": symbol,
                    "success": False,
                    "error": str(exc),
                    "records_upserted": 0,
                }
    return result


# ── Full batch sync ────────────────────────────────────────────────────────────

async def sync_all_symbols(
    batch_size: int = _DEFAULT_BATCH_SIZE,
    delay_seconds: float = _DEFAULT_DELAY_SECONDS,
    years: int = 10,
    skip_synced_today: bool = True,
) -> dict:
    """
    Sync all NSE-listed companies in batches.

    If `skip_synced_today=True` a symbol is skipped when its most recent
    MongoDB record already has today's date — avoids redundant downloads on
    re-run within the same day.

    Returns a summary:
    {
        "job_id": str,
        "total": int,
        "succeeded": int,
        "failed": int,
        "skipped": int,
        "failures": list[{"symbol": str, "error": str}],
        "started_at": ISO-8601 str,
        "finished_at": ISO-8601 str,
    }
    """
    from database import price_history_collection  # import here to avoid circular at module load

    symbols = load_all_symbols()
    total = len(symbols)
    started_at = datetime.utcnow().isoformat() + "Z"
    job_id = f"sync_{started_at[:10]}"

    # Persist job start
    try:
        await sync_jobs_collection.update_one(
            {"job_id": job_id},
            {"$set": {
                "job_id": job_id,
                "status": "running",
                "total": total,
                "succeeded": 0,
                "failed": 0,
                "skipped": 0,
                "started_at": started_at,
            }},
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Could not persist job start: %s", exc)

    succeeded = 0
    failed = 0
    skipped = 0
    failures: list[dict] = []

    today_str = date.today().isoformat()

    for batch_start in range(0, total, batch_size):
        batch = symbols[batch_start:batch_start + batch_size]

        for sym in batch:
            # Skip if already synced today
            if skip_synced_today:
                try:
                    latest = await price_history_collection.find_one(
                        {"symbol": sym},
                        {"date": 1, "_id": 0},
                        sort=[("date", -1)],
                    )
                    if latest and latest.get("date") == today_str:
                        logger.debug("Skipping %s — already synced today", sym)
                        skipped += 1
                        continue
                except Exception:
                    pass  # On DB error, re-sync the symbol

            result = await sync_symbol(sym, years=years)
            if result.get("success"):
                succeeded += 1
            else:
                failed += 1
                failures.append({"symbol": sym, "error": result.get("error", "unknown")})

        # Rate-limit between batches
        if batch_start + batch_size < total:
            await asyncio.sleep(delay_seconds)

        # Update progress
        try:
            await sync_jobs_collection.update_one(
                {"job_id": job_id},
                {"$set": {"succeeded": succeeded, "failed": failed, "skipped": skipped}},
            )
        except Exception:
            pass

    finished_at = datetime.utcnow().isoformat() + "Z"
    summary = {
        "job_id": job_id,
        "total": total,
        "succeeded": succeeded,
        "failed": failed,
        "skipped": skipped,
        "failures": failures[:50],  # cap stored failures list for readability
        "started_at": started_at,
        "finished_at": finished_at,
    }

    try:
        await sync_jobs_collection.update_one(
            {"job_id": job_id},
            {"$set": {"status": "completed", **summary}},
        )
    except Exception as exc:
        logger.warning("Could not persist job completion: %s", exc)

    logger.info(
        "Batch sync finished: %d succeeded, %d failed, %d skipped out of %d",
        succeeded, failed, skipped, total,
    )
    return summary


async def get_latest_sync_status() -> Optional[dict]:
    """Return the most recent sync job document from MongoDB."""
    try:
        doc = await sync_jobs_collection.find_one(
            {},
            {"_id": 0},
            sort=[("started_at", -1)],
        )
        return doc
    except Exception as exc:
        logger.warning("Could not read sync status: %s", exc)
        return None

