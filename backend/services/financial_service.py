from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Callable

from services.api_providers import alpha_provider, fmp_provider, screener_provider, yahoo_provider
from utils.symbol_mapper import map_symbol

logger = logging.getLogger("auditgpt.financial_service")

_HISTORICAL_TTL = timedelta(days=7)
_LATEST_TTL = timedelta(hours=12)
_FAILURE_TTL = timedelta(minutes=10)

_CACHE: dict[str, dict[str, Any]] = {}
_LOCKS: dict[str, threading.Lock] = {}
_LOCKS_GUARD = threading.Lock()

FIELDS = (
    "revenue",
    "netIncome",
    "ebitda",
    "assets",
    "liabilities",
    "debt",
    "cash",
    "cashFlow",
    "freeCashFlow",
)
REQUIRED_FOR_ANALYSIS = ("revenue", "netIncome")


def _lock_for(key: str) -> threading.Lock:
    with _LOCKS_GUARD:
        if key not in _LOCKS:
            _LOCKS[key] = threading.Lock()
        return _LOCKS[key]


def _normalize_row(row: dict) -> dict | None:
    year = row.get("year")
    try:
        year = int(year)
    except (TypeError, ValueError):
        return None
    if year < 1990 or year > datetime.utcnow().year + 1:
        return None
    return {
        "year": year,
        "revenue": row.get("revenue"),
        "netIncome": row.get("netIncome"),
        "ebitda": row.get("ebitda"),
        "assets": row.get("assets"),
        "debt": row.get("debt"),
        "cashFlow": row.get("cashFlow"),
        "source_ticker": row.get("source_ticker"),
    }


def _row_has_any_value(row: dict) -> bool:
    return any(row.get(field) is not None for field in FIELDS)


def _merge_by_priority(rows_list: list[list[dict]], sources: list[str], max_years: int) -> tuple[list[dict], dict[int, list[str]]]:
    merged: dict[int, dict] = {}
    provenance: dict[int, list[str]] = {}
    for idx, rows in enumerate(rows_list):
        source = sources[idx]
        for raw in rows:
            row = _normalize_row(raw)
            if not row or not _row_has_any_value(row):
                continue
            year = row["year"]
            if year not in merged:
                merged[year] = row
                provenance[year] = [source]
                continue
            current = merged[year]
            for field in FIELDS:
                if current.get(field) is None and row.get(field) is not None:
                    current[field] = row[field]
                    if source not in provenance[year]:
                        provenance[year].append(source)
            if not current.get("source_ticker") and row.get("source_ticker"):
                current["source_ticker"] = row["source_ticker"]

    # Oldest → newest so trend / YoY math matches the fraud engine contract.
    normalized = sorted(merged.values(), key=lambda x: x["year"])
    if max_years and len(normalized) > max_years:
        normalized = normalized[-max_years:]
    return normalized, provenance


def _missing_fields(rows: list[dict]) -> list[str]:
    missing: list[str] = []
    if not rows:
        return list(FIELDS)
    for field in FIELDS:
        if all(row.get(field) is None for row in rows):
            missing.append(field)
    return missing


def _period_coverage(rows: list[dict]) -> dict:
    years = [row["year"] for row in rows]
    return {
        "start_year": years[0] if years else None,
        "end_year": years[-1] if years else None,
        "years": years,
        "count": len(years),
    }


def _extract_latest(rows: list[dict]) -> dict | None:
    return rows[-1] if rows else None


def _upsert_latest(existing: list[dict], latest: dict | None) -> list[dict]:
    if not latest:
        return existing
    by_year = {r["year"]: dict(r) for r in existing}
    row = by_year.get(latest["year"], {"year": latest["year"], **{k: None for k in FIELDS}})
    for field in FIELDS:
        if row.get(field) is None and latest.get(field) is not None:
            row[field] = latest[field]
    by_year[latest["year"]] = row
    return sorted(by_year.values(), key=lambda x: x["year"])


def _yahoo_candidates(symbol: str, yahoo_symbols: list[str] | None) -> list[str]:
    mapped = map_symbol(symbol)
    ordered: list[str] = []
    for item in list(yahoo_symbols or []) + [mapped.yahoo]:
        ticker = (item or "").strip()
        if not ticker:
            continue
        if "." not in ticker:
            ticker = f"{ticker}.NS"
        if ticker not in ordered:
            ordered.append(ticker)
    return ordered


def _call_provider(name: str, fn: Callable[[], list[dict]], errors: list[str]) -> list[dict]:
    started = time.perf_counter()
    try:
        rows = fn() or []
        duration_ms = int((time.perf_counter() - started) * 1000)
        if not rows:
            errors.append(f"{name}:empty")
            logger.info("financial provider %s empty (%dms)", name, duration_ms)
            return []
        logger.info("financial provider %s rows=%d (%dms)", name, len(rows), duration_ms)
        return rows
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        errors.append(f"{name}:{type(exc).__name__}")
        logger.warning("financial provider %s failed (%dms): %s", name, duration_ms, str(exc)[:160])
        return []


def _payload(
    symbol: str,
    mapped,
    merged: list[dict],
    provenance: dict[int, list[str]],
    errors: list[str],
    yahoo_tried: list[str],
    cache_mode: str,
) -> dict:
    missing = _missing_fields(merged)
    coverage = _period_coverage(merged)
    required_missing = [f for f in REQUIRED_FOR_ANALYSIS if f in missing]
    success = bool(merged) and not required_missing
    providers_used = sorted({source for sources in provenance.values() for source in sources})
    message = "ok"
    if not merged:
        message = "Financial statements unavailable from all configured providers."
    elif required_missing:
        message = (
            "Financial statements are incomplete. Missing required fields: "
            + ", ".join(required_missing)
        )
    elif missing:
        message = "Financial statements loaded with optional fields missing: " + ", ".join(missing)

    return {
        "success": success,
        "message": message,
        "symbol": symbol,
        "provider_symbols": {
            "yahoo": mapped.yahoo,
            "fmp": mapped.fmp,
            "alpha": mapped.alpha,
            "nse": mapped.nse,
        },
        "yahoo_symbols_tried": yahoo_tried,
        "providers_used": providers_used,
        "provider_failures": errors,
        "available_years": len(merged),
        "period_coverage": coverage,
        "missing_fields": missing,
        "required_missing_fields": required_missing,
        "retrieved_at": datetime.utcnow().isoformat() + "Z",
        "financials": merged,
        "cache_mode": cache_mode,
    }


def get_company_financials(
    symbol: str,
    max_years: int = 10,
    yahoo_symbols: list[str] | None = None,
    force_refresh: bool = False,
) -> dict:
    """
    Multi-provider financial fetch for NSE symbols with fallback and cache.
    Failed/empty responses are cached only briefly so we do not treat them as data.
    """
    mapped = map_symbol(symbol)
    yahoo_tried = _yahoo_candidates(symbol, yahoo_symbols)
    now = datetime.utcnow()
    cache_key = f"{mapped.fmp}|{','.join(yahoo_tried)}|{max_years}"
    lock = _lock_for(cache_key)

    with lock:
        cached = None if force_refresh else _CACHE.get(cache_key)
        if cached:
            age = now - cached["updated_at"]
            payload = cached["payload"]
            ttl = _LATEST_TTL if payload.get("success") else _FAILURE_TTL
            if payload.get("success") and age < _LATEST_TTL:
                return payload
            if not payload.get("success") and age < _FAILURE_TTL:
                return payload
            if payload.get("success") and age < _HISTORICAL_TTL:
                errors: list[str] = []
                latest_rows = [
                    _call_provider("yahoo", lambda: _fetch_yahoo(yahoo_tried, limit=2), errors),
                    _call_provider("fmp", lambda: fmp_provider.fetch_financials(mapped.fmp, limit=2), errors),
                    _call_provider("alpha", lambda: alpha_provider.fetch_financials(mapped.alpha, limit=2), errors),
                    _call_provider("screener", lambda: screener_provider.fetch_financials(mapped.nse, limit=2), errors),
                ]
                latest_merged, _ = _merge_by_priority(latest_rows, ["yahoo", "fmp", "alpha", "screener"], max_years=2)
                latest = _extract_latest(latest_merged)
                refreshed_rows = _upsert_latest(payload["financials"], latest)
                refreshed = dict(payload)
                refreshed["financials"] = refreshed_rows[-max_years:]
                refreshed["available_years"] = len(refreshed["financials"])
                refreshed["period_coverage"] = _period_coverage(refreshed["financials"])
                refreshed["missing_fields"] = _missing_fields(refreshed["financials"])
                refreshed["cache_mode"] = "latest-refresh"
                refreshed["retrieved_at"] = now.isoformat() + "Z"
                _CACHE[cache_key] = {"updated_at": now, "payload": refreshed}
                return refreshed

        errors: list[str] = []
        rows_list: list[list[dict]] = [
            _call_provider("yahoo", lambda: _fetch_yahoo(yahoo_tried, limit=max_years), errors),
            _call_provider("fmp", lambda: fmp_provider.fetch_financials(mapped.fmp, limit=max_years), errors),
            _call_provider("alpha", lambda: alpha_provider.fetch_financials(mapped.alpha, limit=max_years), errors),
            _call_provider("screener", lambda: screener_provider.fetch_financials(mapped.nse, limit=max_years), errors),
        ]
        merged, provenance = _merge_by_priority(rows_list, ["yahoo", "fmp", "alpha", "screener"], max_years=max_years)
        payload = _payload(symbol, mapped, merged, provenance, errors, yahoo_tried, "full-refresh")
        _CACHE[cache_key] = {"updated_at": now, "payload": payload}
        return payload


def _fetch_yahoo(yahoo_tried: list[str], limit: int) -> list[dict]:
    combined: list[list[dict]] = []
    sources: list[str] = []
    for ticker in yahoo_tried:
        rows = yahoo_provider.fetch_financials(ticker, limit=limit)
        if rows:
            for row in rows:
                row["source_ticker"] = ticker
            combined.append(rows)
            sources.append(ticker)
    if not combined:
        return []
    merged, _ = _merge_by_priority(combined, sources, max_years=limit)
    return merged


def clear_financial_cache(symbol: str | None = None) -> None:
    if not symbol:
        _CACHE.clear()
        return
    prefix = map_symbol(symbol).fmp
    for key in list(_CACHE):
        if key.startswith(prefix):
            _CACHE.pop(key, None)
