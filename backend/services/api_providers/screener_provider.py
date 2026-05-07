from __future__ import annotations

import re
from io import StringIO
from typing import Any

import pandas as pd
import requests


BASE_URL = "https://www.screener.in/company"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
CRORE_TO_INR = 10_000_000


def _clean_label(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ").replace("+", "")).strip().lower()


def _safe_num(value: Any) -> float | None:
    if value is None:
        return None
    try:
        text = str(value).replace(",", "").replace("%", "").strip()
        if not text or text.lower() in {"nan", "none", "null"}:
            return None
        return float(text)
    except Exception:
        return None


def _year_from_column(column: Any) -> int | None:
    match = re.search(r"(20\d{2}|19\d{2})", str(column))
    return int(match.group(1)) if match else None


def _row_values(table: pd.DataFrame, candidates: tuple[str, ...]) -> dict[int, float | None]:
    labels = table.iloc[:, 0].map(_clean_label)
    wanted = {candidate.lower() for candidate in candidates}
    row_idx = next((idx for idx, label in labels.items() if label in wanted), None)
    if row_idx is None:
        return {}

    values: dict[int, float | None] = {}
    row = table.loc[row_idx]
    for column in table.columns[1:]:
        year = _year_from_column(column)
        if year is None:
            continue
        values[year] = _safe_num(row[column])
    return values


def _find_table(tables: list[pd.DataFrame], required_labels: tuple[str, ...]) -> pd.DataFrame | None:
    required = {label.lower() for label in required_labels}
    for table in tables:
        if table.empty or table.shape[1] < 2:
            continue
        labels = {_clean_label(value) for value in table.iloc[:, 0].tolist()}
        if required.issubset(labels):
            return table
    return None


def _fetch_tables(symbol: str) -> list[pd.DataFrame]:
    base = (symbol or "").upper().strip()
    if ":" in base:
        base = base.split(":", 1)[1]
    if base.endswith(".NS") or base.endswith(".BO") or base.endswith(".BSE"):
        base = base.rsplit(".", 1)[0]

    urls = [
        f"{BASE_URL}/{base}/consolidated/",
        f"{BASE_URL}/{base}/",
    ]
    for url in urls:
        try:
            response = requests.get(url, headers=HEADERS, timeout=12)
            if response.status_code != 200 or "Company not found" in response.text:
                continue
            tables = pd.read_html(StringIO(response.text))
            if tables:
                return tables
        except Exception:
            continue
    return []


def fetch_financials(symbol: str, limit: int = 10) -> list[dict]:
    """
    Fetch annual NSE financial statements from Screener.in public tables.
    Values on Screener are in INR crore, converted here to INR.
    """
    tables = _fetch_tables(symbol)
    if not tables:
        return []

    pnl = _find_table(tables, ("Net Profit",))
    if pnl is None:
        pnl = _find_table(tables, ("Sales",))
    if pnl is None:
        pnl = _find_table(tables, ("Revenue",))
    balance = _find_table(tables, ("Total Assets",))
    cashflow = _find_table(tables, ("Cash from Operating Activity",))
    if pnl is None:
        return []

    revenue = _row_values(pnl, ("Sales", "Revenue"))
    net_income = _row_values(pnl, ("Net Profit",))
    ebitda = _row_values(pnl, ("Operating Profit", "Financing Profit"))
    assets = _row_values(balance, ("Total Assets",)) if balance is not None else {}
    borrowings = _row_values(balance, ("Borrowings", "Borrowing")) if balance is not None else {}
    deposits = _row_values(balance, ("Deposits",)) if balance is not None else {}
    cash_flow = _row_values(cashflow, ("Cash from Operating Activity",)) if cashflow is not None else {}

    years = sorted(
        set(revenue) | set(net_income) | set(ebitda) | set(assets) | set(borrowings) | set(deposits) | set(cash_flow),
        reverse=True,
    )[:limit]

    rows = []
    for year in years:
        debt_cr = (borrowings.get(year) or 0) + (deposits.get(year) or 0)
        rows.append(
            {
                "year": year,
                "revenue": revenue.get(year) * CRORE_TO_INR if revenue.get(year) is not None else None,
                "netIncome": net_income.get(year) * CRORE_TO_INR if net_income.get(year) is not None else None,
                "ebitda": ebitda.get(year) * CRORE_TO_INR if ebitda.get(year) is not None else None,
                "assets": assets.get(year) * CRORE_TO_INR if assets.get(year) is not None else None,
                "debt": debt_cr * CRORE_TO_INR if debt_cr else None,
                "cashFlow": cash_flow.get(year) * CRORE_TO_INR if cash_flow.get(year) is not None else None,
            }
        )

    return rows
