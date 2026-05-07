from __future__ import annotations

import os
from typing import Any

import requests


FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"


def _safe_num(value: Any) -> float | None:
    try:
        if value is None:
            return None
        num = float(value)
        if num != num:
            return None
        return num
    except Exception:
        return None


def _candidate_symbols(symbol: str) -> list[str]:
    clean = (symbol or "").upper().strip()
    if not clean:
        return []
    base = clean[:-3] if clean.endswith(".NS") else clean
    candidates = [clean]
    if not clean.endswith(".NS"):
        candidates.append(f"{base}.NS")
    candidates.append(base)
    return list(dict.fromkeys(candidates))


def _get_json(url: str, params: dict) -> Any:
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _is_usable_statement(data: Any) -> bool:
    return isinstance(data, list) and any(
        isinstance(row, dict) and row.get("calendarYear") for row in data
    )


def fetch_financials(symbol: str, limit: int = 10) -> list[dict]:
    """
    Fetch annual financials from Financial Modeling Prep.
    """
    api_key = os.getenv("FMP_API_KEY")
    if not api_key:
        return []

    for candidate in _candidate_symbols(symbol):
        balance_url = f"{FMP_BASE_URL}/balance-sheet-statement/{candidate}"
        cash_url = f"{FMP_BASE_URL}/cash-flow-statement/{candidate}"
        params = {"period": "annual", "limit": max(limit, 10), "apikey": api_key}

        try:
            income = _get_json(f"{FMP_BASE_URL}/income-statement/{candidate}", params)
            if not _is_usable_statement(income):
                continue
            balance = _get_json(balance_url, params)
            cash = _get_json(cash_url, params)
        except Exception:
            continue

        if not isinstance(balance, list):
            balance = []
        if not isinstance(cash, list):
            cash = []

        balance_by_year = {int(r["calendarYear"]): r for r in balance if isinstance(r, dict) and r.get("calendarYear")}
        cash_by_year = {int(r["calendarYear"]): r for r in cash if isinstance(r, dict) and r.get("calendarYear")}

        out: list[dict] = []
        for row in income[:limit]:
            if not isinstance(row, dict) or not row.get("calendarYear"):
                continue
            year = int(row["calendarYear"])
            bal = balance_by_year.get(year, {})
            csh = cash_by_year.get(year, {})
            out.append(
                {
                    "year": year,
                    "revenue": _safe_num(row.get("revenue")),
                    "netIncome": _safe_num(row.get("netIncome")),
                    "ebitda": _safe_num(row.get("ebitda")),
                    "assets": _safe_num(bal.get("totalAssets")),
                    "debt": _safe_num(bal.get("totalDebt") or bal.get("longTermDebt")),
                    "cashFlow": _safe_num(csh.get("operatingCashFlow")),
                }
            )
        return out

    return []


def fetch_profile(symbol: str) -> dict:
    """
    Fetch company profile/valuation data from FMP for non-US symbols.
    """
    api_key = os.getenv("FMP_API_KEY")
    if not api_key:
        return {}

    for candidate in _candidate_symbols(symbol):
        try:
            data = _get_json(f"{FMP_BASE_URL}/profile/{candidate}", {"apikey": api_key})
        except Exception:
            continue

        if not isinstance(data, list) or not data or not isinstance(data[0], dict):
            continue

        row = data[0]
        return {
            "longName": row.get("companyName"),
            "shortName": row.get("companyName"),
            "sector": row.get("sector"),
            "industry": row.get("industry"),
            "trailingPE": _safe_num(row.get("pe")),
            "marketCap": _safe_num(row.get("mktCap")),
            "currentPrice": _safe_num(row.get("price")),
            "beta": _safe_num(row.get("beta")),
            "lastDividend": _safe_num(row.get("lastDiv")),
            "source": "fmp",
        }

    return {}
