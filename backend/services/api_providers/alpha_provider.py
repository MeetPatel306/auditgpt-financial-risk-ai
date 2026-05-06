from __future__ import annotations

import os
from typing import Any

import requests


ALPHA_BASE_URL = "https://www.alphavantage.co/query"


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
    Alpha Vantage annual reports fallback.
    """
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    if not api_key:
        return []

    try:
        params = {"function": "INCOME_STATEMENT", "symbol": symbol, "apikey": api_key}
        inc = requests.get(ALPHA_BASE_URL, params=params, timeout=10).json()
        params["function"] = "BALANCE_SHEET"
        bal = requests.get(ALPHA_BASE_URL, params=params, timeout=10).json()
        params["function"] = "CASH_FLOW"
        csh = requests.get(ALPHA_BASE_URL, params=params, timeout=10).json()

        income_reports = inc.get("annualReports", []) if isinstance(inc, dict) else []
        balance_reports = bal.get("annualReports", []) if isinstance(bal, dict) else []
        cash_reports = csh.get("annualReports", []) if isinstance(csh, dict) else []

        if not income_reports:
            return []

        balance_by_year = {
            int(item["fiscalDateEnding"][:4]): item
            for item in balance_reports
            if isinstance(item, dict) and item.get("fiscalDateEnding")
        }
        cash_by_year = {
            int(item["fiscalDateEnding"][:4]): item
            for item in cash_reports
            if isinstance(item, dict) and item.get("fiscalDateEnding")
        }

        out: list[dict] = []
        for row in income_reports[:limit]:
            if not isinstance(row, dict) or not row.get("fiscalDateEnding"):
                continue
            year = int(row["fiscalDateEnding"][:4])
            bal_row = balance_by_year.get(year, {})
            csh_row = cash_by_year.get(year, {})
            out.append(
                {
                    "year": year,
                    "revenue": _safe_num(row.get("totalRevenue")),
                    "netIncome": _safe_num(row.get("netIncome")),
                    "ebitda": _safe_num(row.get("ebitda")),
                    "assets": _safe_num(bal_row.get("totalAssets")),
                    "debt": _safe_num(bal_row.get("totalLiabilities") or bal_row.get("longTermDebt")),
                    "cashFlow": _safe_num(csh_row.get("operatingCashflow")),
                }
            )
        return out
    except Exception:
        return []
