from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from services.api_providers import alpha_provider, fmp_provider, yahoo_provider
from utils.symbol_mapper import map_symbol


_HISTORICAL_TTL = timedelta(days=7)
_LATEST_TTL = timedelta(days=1)
_CACHE: dict[str, dict[str, Any]] = {}

FIELDS = ("revenue", "netIncome", "ebitda", "assets", "debt", "cashFlow")


def _normalize_row(row: dict) -> dict | None:
    year = row.get("year")
    if not isinstance(year, int):
        return None
    normalized = {
        "year": year,
        "revenue": row.get("revenue"),
        "netIncome": row.get("netIncome"),
        "ebitda": row.get("ebitda"),
        "assets": row.get("assets"),
        "debt": row.get("debt"),
        "cashFlow": row.get("cashFlow"),
    }
    if all(normalized.get(field) is None for field in FIELDS):
        return None
    return normalized


def _merge_by_priority(rows_list: list[list[dict]], sources: list[str], max_years: int) -> tuple[list[dict], dict[int, list[str]]]:
    merged: dict[int, dict] = {}
    provenance: dict[int, list[str]] = {}
    for idx, rows in enumerate(rows_list):
        source = sources[idx]
        for raw in rows:
            row = _normalize_row(raw)
            if not row:
                continue
            year = row["year"]
            if year not in merged:
                merged[year] = row
                provenance[year] = [source]
                continue

            # Fill only missing values; never overwrite non-null with null.
            current = merged[year]
            for field in FIELDS:
                if current.get(field) is None and row.get(field) is not None:
                    current[field] = row[field]
                    if source not in provenance[year]:
                        provenance[year].append(source)

    normalized = sorted(merged.values(), key=lambda x: x["year"], reverse=True)
    return normalized[:max_years], provenance


def _extract_latest(rows: list[dict]) -> dict | None:
    current_year = datetime.utcnow().year
    for row in rows:
        if row["year"] >= current_year - 1:
            return row
    return rows[0] if rows else None


def _upsert_latest(existing: list[dict], latest: dict | None) -> list[dict]:
    if not latest:
        return existing
    by_year = {r["year"]: dict(r) for r in existing}
    row = by_year.get(latest["year"], {"year": latest["year"], **{k: None for k in FIELDS}})
    for field in FIELDS:
        if row.get(field) is None and latest.get(field) is not None:
            row[field] = latest[field]
    by_year[latest["year"]] = row
    return sorted(by_year.values(), key=lambda x: x["year"], reverse=True)


def get_company_financials(symbol: str, max_years: int = 10) -> dict:
    """
    Multi-provider financial fetch for NSE symbols with fallback and cache.
    """
    mapped = map_symbol(symbol)
    now = datetime.utcnow()
    cache_key = mapped.fmp
    cached = _CACHE.get(cache_key)

    if cached:
        age = now - cached["updated_at"]
        if age < _LATEST_TTL:
            return cached["payload"]

        # Between 1 day and 7 days: refresh only latest-year values.
        if age < _HISTORICAL_TTL:
            latest_rows: list[list[dict]] = []
            latest_errors: list[str] = []
            for name, call in (
                ("yahoo", lambda: yahoo_provider.fetch_financials(mapped.yahoo, limit=2)),
                ("fmp", lambda: fmp_provider.fetch_financials(mapped.fmp, limit=2)),
                ("alpha", lambda: alpha_provider.fetch_financials(mapped.alpha, limit=2)),
            ):
                try:
                    latest_rows.append(call() or [])
                except Exception as exc:
                    latest_rows.append([])
                    latest_errors.append(f"{name}:{exc}")

            latest_merged, _ = _merge_by_priority(latest_rows, ["yahoo", "fmp", "alpha"], max_years=2)
            latest = _extract_latest(latest_merged)
            if not latest:
                payload = dict(cached["payload"])
                payload["cache_mode"] = "stale-cache"
                payload["provider_failures"] = list(payload.get("provider_failures", [])) + latest_errors
                return payload

            refreshed_rows = _upsert_latest(cached["payload"]["financials"], latest)
            payload = dict(cached["payload"])
            payload["financials"] = refreshed_rows[:max_years]
            payload["available_years"] = len(payload["financials"])
            payload["cache_mode"] = "latest-refresh"
            _CACHE[cache_key] = {"updated_at": now, "payload": payload}
            return payload

    errors: list[str] = []
    rows_list: list[list[dict]] = []

    for name, call in (
        ("yahoo", lambda: yahoo_provider.fetch_financials(mapped.yahoo, limit=max_years)),
        ("fmp", lambda: fmp_provider.fetch_financials(mapped.fmp, limit=max_years)),
        ("alpha", lambda: alpha_provider.fetch_financials(mapped.alpha, limit=max_years)),
    ):
        try:
            rows = call() or []
            rows_list.append(rows)
            if not rows:
                errors.append(f"{name}:empty")
        except Exception as exc:
            rows_list.append([])
            errors.append(f"{name}:{exc}")

    merged, provenance = _merge_by_priority(rows_list, ["yahoo", "fmp", "alpha"], max_years=max_years)
    if not merged:
        return {"success": False, "message": "Data unavailable", "errors": errors, "financials": []}

    providers_used = sorted({source for sources in provenance.values() for source in sources})
    payload = {
        "success": True,
        "message": "ok",
        "symbol": symbol,
        "provider_symbols": {
            "yahoo": mapped.yahoo,
            "fmp": mapped.fmp,
            "alpha": mapped.alpha,
            "nse": mapped.nse,
        },
        "providers_used": providers_used,
        "provider_failures": errors,
        "available_years": len(merged),
        "financials": merged,
        "cache_mode": "full-refresh",
    }
    _CACHE[cache_key] = {"updated_at": now, "payload": payload}
    return payload
