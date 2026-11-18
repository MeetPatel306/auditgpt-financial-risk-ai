from __future__ import annotations

import os
from typing import Any

import requests


<<<<<<< HEAD
FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"
=======
FMP_BASE_URL = "https://financialmodelingprep.com/stable"
>>>>>>> origin/main


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


<<<<<<< HEAD
def _candidates(symbol: str) -> list[str]:
    base = (symbol or "").strip()
    if not base:
        return []
    out = [base]
    if not base.endswith(".NS"):
        out.append(f"{base}.NS")
    return out
=======
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
>>>>>>> origin/main


def fetch_financials(symbol: str, limit: int = 10) -> list[dict]:
    """
    Fetch annual financials from Financial Modeling Prep.
    """
    api_key = os.getenv("FMP_API_KEY")
    if not api_key:
        return []

<<<<<<< HEAD
    last_error = None
    for candidate in _candidates(symbol):
        try:
            rows = _fetch_one(candidate, api_key, limit)
            if rows:
                return rows
        except Exception as exc:
            last_error = exc
            continue
    if last_error:
        return []
    return []


def _fetch_one(symbol: str, api_key: str, limit: int) -> list[dict]:
    income_url = f"{FMP_BASE_URL}/income-statement/{symbol}"
    balance_url = f"{FMP_BASE_URL}/balance-sheet-statement/{symbol}"
    cash_url = f"{FMP_BASE_URL}/cash-flow-statement/{symbol}"
    params = {"period": "annual", "limit": max(limit, 10), "apikey": api_key}

    income = requests.get(income_url, params=params, timeout=10).json()
    balance = requests.get(balance_url, params=params, timeout=10).json()
    cash = requests.get(cash_url, params=params, timeout=10).json()

    if not isinstance(income, list):
        return []

    balance_by_year = {
        int(r["calendarYear"]): r
        for r in (balance if isinstance(balance, list) else [])
        if isinstance(r, dict) and r.get("calendarYear")
    }
    cash_by_year = {
        int(r["calendarYear"]): r
        for r in (cash if isinstance(cash, list) else [])
        if isinstance(r, dict) and r.get("calendarYear")
    }

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
=======
    for candidate in _candidate_symbols(symbol):
        params = {
            "symbol": candidate,
            "period": "annual",
            "limit": max(limit, 10),
            "apikey": api_key,
        }

        try:
            income = _get_json(f"{FMP_BASE_URL}/income-statement", params)
            if not _is_usable_statement(income):
                continue
            balance = _get_json(f"{FMP_BASE_URL}/balance-sheet-statement", params)
            cash = _get_json(f"{FMP_BASE_URL}/cash-flow-statement", params)
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
            data = _get_json(f"{FMP_BASE_URL}/profile", {"symbol": candidate, "apikey": api_key})
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
            "marketCap": _safe_num(row.get("marketCap") or row.get("mktCap")),
            "currentPrice": _safe_num(row.get("price")),
            "beta": _safe_num(row.get("beta")),
            "lastDividend": _safe_num(row.get("lastDiv")),
            "source": "fmp",
        }

    return {}
>>>>>>> origin/main
