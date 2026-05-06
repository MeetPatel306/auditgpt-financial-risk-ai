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


def fetch_financials(symbol: str, limit: int = 10) -> list[dict]:
    """
    Fetch annual financials from Financial Modeling Prep.
    """
    api_key = os.getenv("FMP_API_KEY")
    if not api_key:
        return []

    try:
        income_url = f"{FMP_BASE_URL}/income-statement/{symbol}"
        balance_url = f"{FMP_BASE_URL}/balance-sheet-statement/{symbol}"
        cash_url = f"{FMP_BASE_URL}/cash-flow-statement/{symbol}"
        params = {"period": "annual", "limit": max(limit, 10), "apikey": api_key}

        income = requests.get(income_url, params=params, timeout=10).json()
        balance = requests.get(balance_url, params=params, timeout=10).json()
        cash = requests.get(cash_url, params=params, timeout=10).json()

        if not isinstance(income, list):
            return []

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
    except Exception:
        return []
