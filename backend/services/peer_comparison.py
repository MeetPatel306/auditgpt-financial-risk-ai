"""
Peer comparison service for AuditGPT.
Fetches lightweight financial metrics for peer companies
and builds comparison data.
"""

from __future__ import annotations

import yfinance as yf
import math


def _safe(val):
    """Convert to float, handle None/NaN."""
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _growth_pct(data_list):
    """Calculate growth percentage from first to last non-None value."""
    valid = [v for v in data_list if v is not None]
    if len(valid) < 2 or valid[0] == 0:
        return None
    return round(((valid[-1] - valid[0]) / abs(valid[0])) * 100, 1)


def _debt_ratio(debt_list, revenue_list):
    """Compute latest debt-to-revenue ratio."""
    d = next((v for v in reversed(debt_list) if v is not None), None)
    r = next((v for v in reversed(revenue_list) if v is not None), None)
    if d is not None and r and r > 0:
        return round(d / r, 2)
    return None


def _latest(data_list):
    """Get latest non-None value."""
    return next((v for v in reversed(data_list) if v is not None), None)


def build_input_company_metrics(data: dict) -> dict:
    """
    Extract comparison metrics from the already-fetched analysis data.
    This avoids re-fetching the input company.
    """
    revenue = data.get("revenue_10y", [])
    profit = data.get("profit_10y", [])
    debt = data.get("debt_10y", [])
    cashflow = data.get("cashflow_10y", [])
    info = data.get("company_info", {})

    return {
        "symbol": data.get("nse_symbol", ""),
        "name": data.get("company_name", ""),
        "is_input": True,
        "revenue_growth": _growth_pct(revenue),
        "profit_growth": _growth_pct(profit),
        "debt_ratio": _debt_ratio(debt, revenue),
        "latest_cashflow": _latest(cashflow),
        "latest_revenue": _latest(revenue),
        "latest_profit": _latest(profit),
        "market_cap": info.get("market_cap"),
        "pe_ratio": info.get("pe_ratio"),
        "profit_margin": info.get("profit_margin"),
        "roe": info.get("roe"),
        "risk_score": data.get("fraud_score"),
        "risk_level": data.get("risk_level"),
    }


def fetch_peer_metrics(nse_symbol: str) -> dict | None:
    """
    Fetch lightweight financial metrics for a single peer company.
    Uses only ticker.info + annual statements (fast).
    """
    try:
        ticker = yf.Ticker(f"{nse_symbol}.NS")
        info = ticker.info or {}

        # Get income statement for growth calc
        inc = ticker.income_stmt
        revenue_list = []
        profit_list = []
        if inc is not None and not inc.empty:
            cols = list(reversed(inc.columns))
            for col in cols:
                rev = _safe(inc.loc["Total Revenue", col]) if "Total Revenue" in inc.index else None
                ni = _safe(inc.loc["Net Income", col]) if "Net Income" in inc.index else None
                revenue_list.append(rev)
                profit_list.append(ni)

        # Balance sheet for debt
        bs = ticker.balance_sheet
        debt_list = []
        if bs is not None and not bs.empty:
            cols = list(reversed(bs.columns))
            for col in cols:
                d = _safe(bs.loc["Total Debt", col]) if "Total Debt" in bs.index else None
                if d is None and "Long Term Debt" in bs.index:
                    d = _safe(bs.loc["Long Term Debt", col])
                debt_list.append(d)

        # Cashflow
        cf = ticker.cashflow
        cf_list = []
        if cf is not None and not cf.empty:
            cols = list(reversed(cf.columns))
            for col in cols:
                ocf = _safe(cf.loc["Operating Cash Flow", col]) if "Operating Cash Flow" in cf.index else None
                cf_list.append(ocf)

        # Compute risk score (simplified)
        risk_score = 25
        pe = _safe(info.get("trailingPE"))
        margin = _safe(info.get("profitMargins"))

        if profit_list:
            neg = sum(1 for p in profit_list if p is not None and p < 0)
            risk_score += min(neg * 10, 20)
        dr = _debt_ratio(debt_list, revenue_list)
        if dr is not None and dr > 1:
            risk_score += 10
        if pe is not None and (pe < 0 or pe > 80):
            risk_score += 10
        if margin is not None and margin < 0:
            risk_score += 10
        risk_score = min(risk_score, 95)

        risk_level = (
            "CRITICAL" if risk_score >= 75 else
            "HIGH" if risk_score >= 55 else
            "MODERATE" if risk_score >= 35 else
            "LOW"
        )

        return {
            "symbol": nse_symbol,
            "name": info.get("longName") or info.get("shortName") or nse_symbol,
            "is_input": False,
            "revenue_growth": _growth_pct(revenue_list),
            "profit_growth": _growth_pct(profit_list),
            "debt_ratio": dr,
            "latest_cashflow": _latest(cf_list),
            "latest_revenue": _latest(revenue_list),
            "latest_profit": _latest(profit_list),
            "market_cap": _safe(info.get("marketCap")),
            "pe_ratio": round(pe, 2) if pe else None,
            "profit_margin": round(margin * 100, 2) if margin else None,
            "roe": round(_safe(info.get("returnOnEquity")) * 100, 2) if _safe(info.get("returnOnEquity")) else None,
            "risk_score": risk_score,
            "risk_level": risk_level,
        }
    except Exception as e:
        print(f"Error fetching peer {nse_symbol}: {e}")
        return None


def build_comparison(analysis_data: dict, peer_symbols: list[str], max_peers: int = 5) -> dict:
    """
    Build full comparison data: input company + peers.
    Limits peers to max_peers for API speed.
    """
    input_metrics = build_input_company_metrics(analysis_data)

    peers = []
    for sym in peer_symbols[:max_peers]:
        m = fetch_peer_metrics(sym)
        if m:
            peers.append(m)

    all_companies = [input_metrics] + peers

    # Compute highlights
    highlights = _compute_highlights(all_companies)

    return {
        "input_company": input_metrics,
        "peers": peers,
        "all_companies": all_companies,
        "highlights": highlights,
    }


def _compute_highlights(companies: list[dict]) -> dict:
    """Identify best/worst performers across metrics."""
    def _best(key, higher_is_better=True):
        valid = [(c["symbol"], c[key]) for c in companies if c.get(key) is not None]
        if not valid:
            return None
        return max(valid, key=lambda x: x[1])[0] if higher_is_better else min(valid, key=lambda x: x[1])[0]

    return {
        "best_revenue_growth": _best("revenue_growth", True),
        "best_profit_growth": _best("profit_growth", True),
        "highest_debt": _best("debt_ratio", True),
        "lowest_debt": _best("debt_ratio", False),
        "lowest_profit": _best("latest_profit", False),
        "best_profit_margin": _best("profit_margin", True),
        "highest_market_cap": _best("market_cap", True),
        "lowest_risk": _best("risk_score", False),
        "highest_risk": _best("risk_score", True),
        "best_pe": _best("pe_ratio", False),  # lower PE is generally better
    }
