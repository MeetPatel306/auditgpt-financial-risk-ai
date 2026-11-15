from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import yfinance as yf

logger = logging.getLogger("auditgpt.yahoo_provider")

INCOME_REVENUE = ["Total Revenue", "Operating Revenue", "Revenue", "TotalRevenue"]
INCOME_NET = [
    "Net Income",
    "Net Income Common Stockholders",
    "Net Income From Continuing Operation Net Minority Interest",
    "Net Income Continuous Operations",
    "NetIncome",
]
INCOME_EBITDA = ["EBITDA", "Normalized EBITDA", "Ebitda"]
BALANCE_ASSETS = ["Total Assets", "TotalAssets"]
BALANCE_DEBT = ["Total Debt", "Long Term Debt", "TotalDebt", "Net Debt"]
CASH_FLOW = [
    "Operating Cash Flow",
    "Cash Flow From Continuing Operating Activities",
    "OperatingCashFlow",
    "Total Cash From Operating Activities",
]


def _safe_num(value: Any) -> float | None:
    try:
        if value is None:
            return None
        num = float(value)
        if num != num or num in (float("inf"), float("-inf")):
            return None
        return num
    except Exception:
        return None


def _period_year(col) -> int | None:
    year = getattr(col, "year", None)
    if isinstance(year, int) and 1990 <= year <= datetime.utcnow().year + 1:
        return year
    if hasattr(col, "to_pydatetime"):
        try:
            return col.to_pydatetime().year
        except Exception:
            pass
    text = str(col)
    for token in (text[:4],):
        if token.isdigit():
            year = int(token)
            if 1990 <= year <= datetime.utcnow().year + 1:
                return year
    return None


def _period_sort_key(col):
    year = _period_year(col) or 0
    month = getattr(col, "month", 12) or 12
    day = getattr(col, "day", 31) or 31
    return (year, month, day)


def _statement_frames(ticker):
    income = None
    balance = None
    cashflow = None
    for name in ("income_stmt", "financials", "annual_income_stmt"):
        try:
            frame = getattr(ticker, name, None)
            if frame is not None and getattr(frame, "empty", True) is False:
                income = frame
                break
        except Exception:
            continue
    if income is None:
        try:
            income = ticker.get_income_stmt(freq="yearly")
        except Exception:
            income = None

    for name in ("balance_sheet", "annual_balance_sheet"):
        try:
            frame = getattr(ticker, name, None)
            if frame is not None and getattr(frame, "empty", True) is False:
                balance = frame
                break
        except Exception:
            continue
    if balance is None:
        try:
            balance = ticker.get_balance_sheet(freq="yearly")
        except Exception:
            pass

    for name in ("cashflow", "cash_flow", "annual_cashflow"):
        try:
            frame = getattr(ticker, name, None)
            if frame is not None and getattr(frame, "empty", True) is False:
                cashflow = frame
                break
        except Exception:
            continue
    if cashflow is None:
        try:
            cashflow = ticker.get_cash_flow(freq="yearly")
        except Exception:
            pass

    return income, balance, cashflow


def _collect_years(*frames) -> list[int]:
    years: set[int] = set()
    for frame in frames:
        if frame is None or getattr(frame, "empty", True):
            continue
        for col in frame.columns:
            year = _period_year(col)
            if year:
                years.add(year)
    return sorted(years, reverse=True)


def _read_metric(frame, candidates: list[str], col) -> float | None:
    if frame is None or getattr(frame, "empty", True) or col is None:
        return None
    index_map = {str(idx).strip().lower(): idx for idx in frame.index}
    for name in candidates:
        key = name.strip().lower()
        idx = index_map.get(key)
        if idx is None:
            continue
        try:
            val = frame.loc[idx, col]
            if hasattr(val, "iloc"):
                val = val.iloc[0]
            num = _safe_num(val)
            if num is not None:
                return num
        except Exception:
            continue
    return None


def _col_for_year(frame, year: int):
    if frame is None or getattr(frame, "empty", True):
        return None
    cols = [col for col in frame.columns if _period_year(col) == year]
    if not cols:
        return None
    return max(cols, key=_period_sort_key)


def fetch_financials(symbol: str, limit: int = 10) -> list[dict]:
    """
    Fetch annual financials from Yahoo in normalized format.
    Distinguishes missing metrics (None) from legitimate zeros.
    """
    ticker = yf.Ticker(symbol)
    income_stmt, balance_sheet, cashflow_stmt = _statement_frames(ticker)

    years = _collect_years(income_stmt, balance_sheet, cashflow_stmt)[:limit]
    if not years:
        logger.info("yahoo_provider empty statements for %s", symbol)
        return []

    out: list[dict] = []
    for year in years:
        inc_col = _col_for_year(income_stmt, year)
        bal_col = _col_for_year(balance_sheet, year)
        cf_col = _col_for_year(cashflow_stmt, year)
        out.append(
            {
                "year": year,
                "revenue": _read_metric(income_stmt, INCOME_REVENUE, inc_col),
                "netIncome": _read_metric(income_stmt, INCOME_NET, inc_col),
                "ebitda": _read_metric(income_stmt, INCOME_EBITDA, inc_col),
                "assets": _read_metric(balance_sheet, BALANCE_ASSETS, bal_col),
                "debt": _read_metric(balance_sheet, BALANCE_DEBT, bal_col),
                "cashFlow": _read_metric(cashflow_stmt, CASH_FLOW, cf_col),
                "source_ticker": symbol,
            }
        )
    return out
