from __future__ import annotations

from typing import Any

import yfinance as yf


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


def _collect_years(*frames) -> list[int]:
    years: set[int] = set()
    for frame in frames:
        if frame is None or frame.empty:
            continue
        for col in frame.columns:
            year = getattr(col, "year", None)
            if isinstance(year, int):
                years.add(year)
    return sorted(years, reverse=True)


def _read_metric(frame, candidates: list[str], col) -> float | None:
    if frame is None or frame.empty:
        return None
    for name in candidates:
        if name in frame.index:
            return _safe_num(frame.loc[name, col])
    return None


def fetch_financials(symbol: str, limit: int = 10) -> list[dict]:
    """
    Fetch annual financials from Yahoo in normalized format.
    """
    ticker = yf.Ticker(symbol)
    income_stmt = ticker.income_stmt
    balance_sheet = ticker.balance_sheet
    cashflow_stmt = ticker.cashflow

    years = _collect_years(income_stmt, balance_sheet, cashflow_stmt)[:limit]
    if not years:
        return []

    def _col_for_year(frame, year: int):
        if frame is None or frame.empty:
            return None
        for col in frame.columns:
            if getattr(col, "year", None) == year:
                return col
        return None

    out: list[dict] = []
    for year in years:
        inc_col = _col_for_year(income_stmt, year)
        bal_col = _col_for_year(balance_sheet, year)
        cf_col = _col_for_year(cashflow_stmt, year)

        revenue = _read_metric(income_stmt, ["Total Revenue", "Operating Revenue"], inc_col)
        net_income = _read_metric(income_stmt, ["Net Income", "Net Income Common Stockholders"], inc_col)
        ebitda = _read_metric(income_stmt, ["EBITDA"], inc_col)
        assets = _read_metric(balance_sheet, ["Total Assets"], bal_col)
        debt = _read_metric(balance_sheet, ["Total Debt", "Long Term Debt"], bal_col)
        cash_flow = _read_metric(
            cashflow_stmt,
            ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"],
            cf_col,
        )

        out.append(
            {
                "year": year,
                "revenue": revenue,
                "netIncome": net_income,
                "ebitda": ebitda,
                "assets": assets,
                "debt": debt,
                "cashFlow": cash_flow,
            }
        )
    return out
