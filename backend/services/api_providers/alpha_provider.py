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


def _candidate_symbols(symbol: str) -> list[str]:
    clean = (symbol or "").upper().strip()
    if not clean:
        return []
    base = clean.split(":", 1)[1] if clean.startswith("NSE:") else clean
    if base.endswith(".BSE") or base.endswith(".NSE"):
        base = base.rsplit(".", 1)[0]
    return list(dict.fromkeys([clean, f"{base}.BSE", f"{base}.NSE", base]))


def _fetch_report(function: str, symbol: str, api_key: str) -> dict:
    params = {"function": function, "symbol": symbol, "apikey": api_key}
    resp = requests.get(ALPHA_BASE_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, dict) else {}


def fetch_financials(symbol: str, limit: int = 10) -> list[dict]:
    """
    Alpha Vantage annual reports fallback.
    """
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    if not api_key:
        return []

    for candidate in _candidate_symbols(symbol):
        try:
            inc = _fetch_report("INCOME_STATEMENT", candidate, api_key)
            income_reports = inc.get("annualReports", [])
            if not income_reports:
                continue
            bal = _fetch_report("BALANCE_SHEET", candidate, api_key)
            csh = _fetch_report("CASH_FLOW", candidate, api_key)
        except Exception:
            continue

        balance_reports = bal.get("annualReports", []) if isinstance(bal, dict) else []
        cash_reports = csh.get("annualReports", []) if isinstance(csh, dict) else []

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

    return []
