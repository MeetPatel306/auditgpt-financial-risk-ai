"""
Yahoo Finance data service for AuditGPT.
FIXED VERSION — All 7 fixes applied:
  Fix 1: DVR map, SME detection, data quality check, BSE fallback
  Fix 3: Extended to 10-year data
  Fix 4: Live price feed from NSE
  Fix 6: Decisive AI summary tone with TL;DR and investor action
"""

import yfinance as yf
import math
import requests
import hashlib
import random
from datetime import datetime
from services.sector_map import get_similar_companies
from services.peer_comparison import build_comparison
from services.fraud_engine import compute_fraud_score
from services.auditor_sentiment import analyze_auditor_sentiment
from services.financial_service import get_company_financials


# ── FIX 1: DVR Symbol Map ─────────────────────────────────────────────────────
# Maps DVR share symbols to their parent company for financial data
DVR_MAP = {
    "TATAMTRDVR":    "TATAMOTORS",
    "JSWSTEEL-DVR":  "JSWSTEEL",
    "TATASTEELDVR":  "TATASTEEL",
    "FUTRETAILDVR":  "FUTRETAIL",
}

# ── FIX 1: Known SME / illiquid symbols that have no Yahoo financial data ─────
SME_SERIES = {"SM", "ST", "SB"}  # NSE series codes for SME stocks


def _resolve_dvr(symbol: str) -> tuple[str, bool]:
    """
    Resolve a DVR symbol to its parent company.
    Returns (resolved_symbol, was_dvr).
    """
    upper = symbol.upper().strip()
    if upper in DVR_MAP:
        return DVR_MAP[upper], True
    return upper, False


def _provider_error_message(exc: Exception) -> str:
    msg = str(exc) or exc.__class__.__name__
    if "Too Many Requests" in msg or "Rate limited" in msg or "429" in msg:
        return "Financial data provider is rate-limited. Using estimated fallback data for now."
    return "Financial data provider is temporarily unavailable. Using estimated fallback data for now."


def _company_name_from_nse(symbol: str) -> str:
    try:
        from services.nse_validator import validate_nse_company

        matched = validate_nse_company(symbol)
        if matched:
            return matched.get("name") or symbol
    except Exception:
        pass
    return symbol


def _safe_ticker_info(ticker_obj) -> tuple[dict, str | None]:
    try:
        return ticker_obj.info or {}, None
    except Exception as exc:
        return {}, _provider_error_message(exc)


def _estimated_financial_payload(symbol: str, max_years: int = 10) -> dict:
    """
    Last-resort deterministic fallback for production provider outages.
    It keeps the app functional, but the response is explicitly marked as estimated.
    """
    seed = int(hashlib.sha256(symbol.upper().encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    current_year = datetime.utcnow().year
    latest_report_year = current_year - 1

    base_revenue = rng.uniform(3e10, 2.5e12)
    margin = rng.uniform(0.035, 0.19)
    debt_ratio = rng.uniform(0.08, 0.75)
    growth = rng.uniform(-0.04, 0.14)

    rows = []
    for idx in range(max_years):
        year = latest_report_year - (max_years - idx - 1)
        cycle = 1 + math.sin(idx / 1.7) * rng.uniform(0.015, 0.055)
        revenue = base_revenue * ((1 + growth) ** idx) * cycle
        net_income = revenue * (margin + rng.uniform(-0.018, 0.018))
        ebitda = revenue * (margin + rng.uniform(0.055, 0.12))
        assets = revenue * rng.uniform(0.85, 1.85)
        debt = revenue * debt_ratio * rng.uniform(0.8, 1.2)
        cash_flow = net_income * rng.uniform(0.75, 1.35)
        rows.append(
            {
                "year": year,
                "revenue": round(revenue, 2),
                "netIncome": round(net_income, 2),
                "ebitda": round(ebitda, 2),
                "assets": round(assets, 2),
                "debt": round(debt, 2),
                "cashFlow": round(cash_flow, 2),
                "estimated": True,
            }
        )

    return {
        "success": True,
        "message": "estimated_fallback",
        "symbol": symbol,
        "provider_symbols": {"yahoo": f"{symbol}.NS", "nse": f"NSE:{symbol}"},
        "providers_used": ["estimated_fallback"],
        "provider_failures": ["live providers unavailable"],
        "available_years": len(rows),
        "financials": sorted(rows, key=lambda row: row["year"], reverse=True),
        "cache_mode": "estimated-fallback",
        "estimated": True,
    }


def _safe_val(val):
    """Convert numpy/pandas values to plain Python, handle NaN."""
    if val is None:
        return None
    try:
        if math.isnan(float(val)):
            return None
        return float(val)
    except (TypeError, ValueError):
        return None


def _format_large_number(val):
    """Format a number in human readable INR form."""
    if val is None:
        return "N/A"
    val = abs(float(val))
    if val >= 1e12:
        return f"₹{val/1e12:.2f}T"
    if val >= 1e9:
        return f"₹{val/1e9:.2f}B"
    if val >= 1e7:
        return f"₹{val/1e7:.2f}Cr"
    if val >= 1e5:
        return f"₹{val/1e5:.2f}L"
    return f"₹{val:,.0f}"


# ── FIX 1: Data Quality Checker ───────────────────────────────────────────────
def _check_data_quality(ticker_obj) -> str:
    """
    Check how many years of financial data are available.
    Returns: 'good' (4+ years) | 'partial' (2-3 years) | 'insufficient' (<2 years) | 'no_data'
    """
    try:
        financials = ticker_obj.income_stmt
        if financials is None or financials.empty:
            return "no_data"
        years = len(financials.columns)
        if years >= 4:
            return "good"
        if years >= 2:
            return "partial"
        if years >= 1:
            return "insufficient"
        return "no_data"
    except Exception:
        return "no_data"


# ── FIX 4: Live NSE Price Feed ────────────────────────────────────────────────
def _fetch_live_nse_price(symbol: str) -> dict:
    """
    Fetch live price data from NSE India unofficial API.
    Returns price dict or empty dict if unavailable.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
            "Referer": "https://www.nseindia.com/",
        }
        session = requests.Session()
        # First hit NSE homepage to get cookies
        session.get("https://www.nseindia.com", headers=headers, timeout=5)
        url = f"https://www.nseindia.com/api/quote-equity?symbol={symbol}"
        resp = session.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            price_info = data.get("priceInfo", {})
            metadata   = data.get("metadata", {})
            return {
                "live_price":        _safe_val(price_info.get("lastPrice")),
                "day_change":        _safe_val(price_info.get("change")),
                "day_change_pct":    _safe_val(price_info.get("pChange")),
                "day_high":          _safe_val(price_info.get("intraDayHighLow", {}).get("max")),
                "day_low":           _safe_val(price_info.get("intraDayHighLow", {}).get("min")),
                "week52_high":       _safe_val(price_info.get("weekHighLow", {}).get("max")),
                "week52_low":        _safe_val(price_info.get("weekHighLow", {}).get("min")),
                "volume":            _safe_val(metadata.get("totalTradedVolume")),
                "avg_volume":        _safe_val(metadata.get("cmAdjHighLow", {}).get("value")),
                "last_updated":      datetime.utcnow().isoformat(),
                "volume_anomaly":    False,  # computed below
            }
    except Exception as e:
        print(f"NSE live price fetch failed for {symbol}: {e}")
    return {}


def _detect_volume_anomaly(live_data: dict) -> dict:
    """Flag volume anomaly if today's volume is 3x average."""
    vol     = live_data.get("volume")
    avg_vol = live_data.get("avg_volume")
    if vol and avg_vol and avg_vol > 0:
        ratio = vol / avg_vol
        live_data["volume_ratio"]   = round(ratio, 2)
        live_data["volume_anomaly"] = ratio >= 3.0
    return live_data


# ── Main Fetch Function ───────────────────────────────────────────────────────
def fetch_company_data(nse_symbol: str) -> dict:
    """
    Fetch real financial data from Yahoo Finance for an NSE-listed company.
    FIXED: DVR resolution, 10-year data, live price, quality warnings.
    """
    # FIX 1: Resolve DVR to parent
    resolved_symbol, is_dvr = _resolve_dvr(nse_symbol)
    ticker_symbol = f"{resolved_symbol}.NS"
    ticker = yf.Ticker(ticker_symbol)

    # FIX 1: Check data quality — try BSE fallback if NS fails
    quality = _check_data_quality(ticker)
    data_warning = None
    used_bse_fallback = False

    if quality == "no_data":
        # Try BSE suffix as fallback
        ticker_bse = yf.Ticker(f"{resolved_symbol}.BO")
        quality_bse = _check_data_quality(ticker_bse)
        if quality_bse != "no_data":
            ticker = ticker_bse
            quality = quality_bse
            used_bse_fallback = True
            data_warning = "Data sourced from BSE (NSE data unavailable for this symbol)."
        else:
            data_warning = (
                "No financial data available for this symbol. "
                "This may be an SME-listed, recently IPO'd, or suspended company."
            )

    if quality == "partial":
        data_warning = (
            "Only 2–3 years of financial data available. "
            "This company may be recently listed. Fraud score accuracy is reduced."
        )
    elif quality == "insufficient":
        data_warning = (
            "Less than 2 years of data available — fraud score not reliable. "
            "Check back after the next annual result."
        )

    if is_dvr:
        dvr_note = (
            f"DVR share detected. Showing financial data from parent company "
            f"{resolved_symbol} — DVR shares carry identical financials with different voting rights."
        )
        data_warning = dvr_note if not data_warning else dvr_note + " " + data_warning

    # --- Company Info ---
    info, info_warning = _safe_ticker_info(ticker)
    if info_warning:
        data_warning = info_warning if not data_warning else f"{data_warning} {info_warning}"

    company_name    = info.get("longName") or info.get("shortName") or _company_name_from_nse(nse_symbol)
    sector          = info.get("sector", "N/A")
    industry        = info.get("industry", "N/A")
    pe_ratio        = _safe_val(info.get("trailingPE"))
    forward_pe      = _safe_val(info.get("forwardPE"))
    market_cap      = _safe_val(info.get("marketCap"))
    current_price   = _safe_val(info.get("currentPrice"))
    fifty_two_week_high = _safe_val(info.get("fiftyTwoWeekHigh"))
    fifty_two_week_low  = _safe_val(info.get("fiftyTwoWeekLow"))
    dividend_yield  = _safe_val(info.get("dividendYield"))
    beta            = _safe_val(info.get("beta"))
    book_value      = _safe_val(info.get("bookValue"))
    roe             = _safe_val(info.get("returnOnEquity"))
    profit_margin   = _safe_val(info.get("profitMargins"))

    # FIX 4: Fetch live NSE price (overrides Yahoo static price)
    live_price_data = _fetch_live_nse_price(resolved_symbol)
    live_price_data = _detect_volume_anomaly(live_price_data)
    if live_price_data.get("live_price"):
        current_price = live_price_data["live_price"]

    # --- Multi-provider annual financial statements (up to 10 years) ---
    financial_payload = get_company_financials(resolved_symbol, max_years=10)
    if not financial_payload.get("success"):
        financial_payload = _estimated_financial_payload(resolved_symbol, max_years=10)
        fallback_warning = (
            "Live financial providers are unavailable or rate-limited in deployment. "
            "Showing estimated fallback financials so the dashboard remains usable; "
            "do not treat these figures as official statements."
        )
        data_warning = fallback_warning if not data_warning else f"{data_warning} {fallback_warning}"
        quality = "estimated"

    # financial_service keeps rows newest-first for cache refreshes. The fraud
    # engine and charts expect oldest -> newest so growth and "latest" are sane.
    merged_financials = sorted(
        financial_payload.get("financials", []),
        key=lambda row: row.get("year") or 0,
    )
    years         = [str(row["year"]) for row in merged_financials]
    revenue_data  = [_safe_val(row.get("revenue")) for row in merged_financials]
    profit_data   = [_safe_val(row.get("netIncome")) for row in merged_financials]
    debt_data     = [_safe_val(row.get("debt")) for row in merged_financials]
    cashflow_data = [_safe_val(row.get("cashFlow")) for row in merged_financials]
    ebitda_data   = [_safe_val(row.get("ebitda")) for row in merged_financials]
    assets_data   = [_safe_val(row.get("assets")) for row in merged_financials]
    expense_data  = [
        (revenue_data[i] - profit_data[i]) if (revenue_data[i] is not None and profit_data[i] is not None) else None
        for i in range(len(years))
    ]

    # --- Fraud Detection Engine ---
    fraud_result    = compute_fraud_score(
        revenue=revenue_data, profit=profit_data,
        debt=debt_data, cashflow=cashflow_data,
        pe=pe_ratio, roe=roe, beta=beta,
    )
    risk_score      = fraud_result["fraud_score"]
    risk_flags      = fraud_result["reason_strings"]
    risk_reasons    = fraud_result["reasons"]
    score_breakdown = fraud_result["score_breakdown"]
    risk_level      = fraud_result["risk_level"]
    risk_color      = fraud_result["risk_color"]

    # FIX 4: Volume anomaly adds a red flag automatically
    if live_price_data.get("volume_anomaly"):
        vol_ratio = live_price_data.get("volume_ratio", 0)
        volume_flag = (
            f"Abnormal trading volume detected today — {vol_ratio:.1f}x above average. "
            "Unusual volume spikes can precede major news, insider activity, or price manipulation."
        )
        risk_flags = [volume_flag] + risk_flags
        risk_reasons = [{
            "severity": "HIGH",
            "category": "Market Signals",
            "points": 8,
            "reason": volume_flag,
        }] + risk_reasons
        risk_score = min(95, risk_score + 8)

    # --- Risk categories ---
    risk_categories = _compute_risk_categories(
        revenue_data, profit_data, debt_data, cashflow_data,
        pe_ratio, profit_margin, roe
    )

    # --- Revenue trend for charts ---
    revenue_trend = []
    expense_trend = []
    for i, yr in enumerate(years):
        rev    = revenue_data[i] if i < len(revenue_data) else None
        exp    = expense_data[i] if i < len(expense_data) else None
        profit = profit_data[i]  if i < len(profit_data)  else None
        is_anomaly = False
        if i > 0 and rev is not None and revenue_data[i - 1] is not None:
            if revenue_data[i - 1] > 0:
                change = (rev - revenue_data[i - 1]) / revenue_data[i - 1]
                if change < -0.20:
                    is_anomaly = True
        if profit is not None and profit < 0:
            is_anomaly = True

        revenue_trend.append({"month": yr, "value": rev or 0, "anomaly": is_anomaly})
        expense_trend.append({"month": yr, "value": exp or 0, "anomaly": is_anomaly})

    anomaly_flags = [
        {"month": item["month"], "type": "Revenue/profit anomaly detected"}
        for item in revenue_trend if item["anomaly"]
    ]

    # FIX 6: Decisive AI Summary with TL;DR
    summary = _generate_summary(
        company_name, risk_level, risk_score, risk_flags,
        revenue_data, profit_data, debt_data, years,
        sector, industry, pe_ratio, market_cap, profit_margin
    )

    # --- Auditor Sentiment ---
    sentiment_data = analyze_auditor_sentiment(
        years=years, revenue=revenue_data, profit=profit_data,
        debt=debt_data, cashflow=cashflow_data,
    )

    latest_revenue = next((v for v in reversed(revenue_data) if v is not None), None)
    latest_expenses = next((v for v in reversed(expense_data) if v is not None), None)

    similar      = get_similar_companies(nse_symbol, sector, count=5)
    peer_symbols = [c["symbol"] for c in similar[:5]]

    result = {
        "company_name":     company_name,
        "nse_symbol":       resolved_symbol,
        "original_symbol":  nse_symbol,
        "is_dvr":           is_dvr,
        "analyzed_at":      datetime.utcnow().isoformat(),
        "fraud_score":      risk_score,
        "risk_level":       risk_level,
        "risk_color":       risk_color,
        "summary":          summary,
        "red_flags":        risk_flags,
        "revenue_trend":    revenue_trend,
        "expense_trend":    expense_trend,
        "anomaly_flags":    anomaly_flags,
        "risk_categories":  risk_categories,
        # FIX 1: Data quality fields
        "data_quality":     quality,
        "data_warning":     data_warning,
        "is_estimated":     bool(financial_payload.get("estimated")),
        "used_bse_fallback": used_bse_fallback,
        # FIX 3: 10y data (up to what Yahoo provides)
        "data_years_available": len(years),
        "financial_data_sources": financial_payload.get("providers_used", []),
        "provider_failures": financial_payload.get("provider_failures", []),
        "financials": {
            "total_revenue":       latest_revenue or 0,
            "total_expenses":      latest_expenses or 0,
            "anomalies_detected":  len(anomaly_flags),
            "periods_reviewed":    len(years),
            "data_completeness":   _calc_completeness(revenue_data, profit_data, debt_data, cashflow_data),
        },
        "financials_normalized": merged_financials,
        "years":         years,
        "revenue_10y":   revenue_data,
        "profit_10y":    profit_data,
        "ebitda_10y":    ebitda_data,
        "assets_10y":    assets_data,
        "debt_10y":      debt_data,
        "cashflow_10y":  cashflow_data,
        "company_info": {
            "sector":              sector,
            "industry":            industry,
            "pe_ratio":            round(pe_ratio, 2)       if pe_ratio       else None,
            "forward_pe":          round(forward_pe, 2)     if forward_pe     else None,
            "market_cap":          market_cap,
            "current_price":       current_price,
            "fifty_two_week_high": fifty_two_week_high,
            "fifty_two_week_low":  fifty_two_week_low,
            "dividend_yield":      round(dividend_yield * 100, 2) if dividend_yield else None,
            "beta":                round(beta, 2)           if beta           else None,
            "book_value":          book_value,
            "roe":                 round(roe * 100, 2)      if roe            else None,
            "profit_margin":       round(profit_margin * 100, 2) if profit_margin else None,
        },
        # FIX 4: Live price data
        "live_price": live_price_data if live_price_data else None,
        "similar_companies": similar,
        "fraud_details": {
            "reasons":         risk_reasons,
            "score_breakdown": score_breakdown,
        },
        "auditor_sentiment": sentiment_data,
    }

    if result.get("is_estimated"):
        result["comparison"] = build_comparison(result, [], max_peers=0)
    else:
        try:
            result["comparison"] = build_comparison(result, peer_symbols, max_peers=5)
        except Exception as e:
            print(f"Peer comparison error: {e}")
            result["comparison"] = None

    return result


def _calc_completeness(revenue, profit, debt, cashflow):
    total = filled = 0
    for arr in [revenue, profit, debt, cashflow]:
        for v in arr:
            total += 1
            if v is not None:
                filled += 1
    return round((filled / total) * 100) if total > 0 else 0


def _compute_risk_categories(revenue, profit, debt, cashflow, pe, margin, roe):
    categories = []

    # Revenue Stability
    rev_score = 30
    if len(revenue) >= 2:
        valid = [r for r in revenue if r is not None]
        if len(valid) >= 2:
            if valid[-1] > valid[0]:
                rev_score = max(10, 30 - int((valid[-1] / valid[0] - 1) * 50))
            else:
                rev_score = min(90, 30 + int((1 - valid[-1] / valid[0]) * 100))
    categories.append({"category": "Revenue Stability", "score": max(5, min(95, rev_score))})

    # Profitability
    prof_score = 30
    if profit:
        neg = sum(1 for p in profit if p is not None and p < 0)
        prof_score = min(90, 20 + neg * 20)
        if margin is not None:
            if margin > 0.15:
                prof_score = max(5, prof_score - 15)
            elif margin < 0:
                prof_score = min(90, prof_score + 20)
    categories.append({"category": "Profitability", "score": max(5, min(95, prof_score))})

    # Debt Risk
    debt_score = 25
    if debt and revenue:
        latest_d = next((d for d in reversed(debt) if d is not None), None)
        latest_r = next((r for r in reversed(revenue) if r is not None), None)
        if latest_d and latest_r and latest_r > 0:
            ratio = latest_d / latest_r
            debt_score = min(90, int(ratio * 40))
    categories.append({"category": "Debt Risk", "score": max(5, min(95, debt_score))})

    # Cash Flow Health
    cf_score = 25
    if cashflow:
        neg = sum(1 for c in cashflow if c is not None and c < 0)
        cf_score = min(90, 15 + neg * 25)
    categories.append({"category": "Cash Flow Health", "score": max(5, min(95, cf_score))})

    # Valuation Risk
    val_score = 30
    if pe is not None:
        if pe < 0:        val_score = 80
        elif pe > 100:    val_score = 75
        elif pe > 50:     val_score = 55
        elif pe > 30:     val_score = 40
        elif pe > 15:     val_score = 25
        else:             val_score = 15
    categories.append({"category": "Valuation Risk", "score": max(5, min(95, val_score))})

    # Capital Efficiency
    eff_score = 30
    if roe is not None:
        if roe > 0.20:    eff_score = 10
        elif roe > 0.10:  eff_score = 25
        elif roe > 0:     eff_score = 45
        else:             eff_score = 75
    categories.append({"category": "Capital Efficiency", "score": max(5, min(95, eff_score))})

    return categories


# ── FIX 2 + FIX 6: Score Explainer per dimension ─────────────────────────────
def get_score_explanation(score_breakdown: dict, risk_categories: list) -> list:
    """
    For each risk dimension, return a plain-English explanation of the score.
    This powers the 'Why?' expandable row in the UI (Fix 2).
    """
    explanations = []
    desc_map = {
        "Revenue Stability":  "Based on revenue growth trend across available years. Higher score = more volatile/declining revenue.",
        "Profitability":      "Based on net profit margin level and direction. Higher score = shrinking or negative margins.",
        "Debt Risk":          "Based on debt-to-revenue ratio. Higher score = more leveraged balance sheet.",
        "Cash Flow Health":   "Based on operating cash flow consistency. Higher score = more negative or declining cash flows.",
        "Valuation Risk":     "Based on PE ratio relative to norms. Higher score = overvalued or loss-making.",
        "Capital Efficiency": "Based on Return on Equity. Higher score = poor returns on shareholders capital.",
    }
    for cat in risk_categories:
        name  = cat["category"]
        score = cat["score"]
        points_from_engine = score_breakdown.get(name, 0)
        explanations.append({
            "category":    name,
            "score":       score,
            "points":      points_from_engine,
            "explanation": desc_map.get(name, ""),
            "level": (
                "critical" if score >= 75 else
                "high"     if score >= 55 else
                "moderate" if score >= 35 else
                "low"
            ),
        })
    return explanations


# ── FIX 6: Decisive AI Summary ────────────────────────────────────────────────
def _generate_summary(name, risk_level, score, flags, revenue, profit,
                      debt, years, sector, industry, pe, mcap, margin):
    """
    FIX 6: Decisive tone with TL;DR, specific concerns, and investor action.
    """

    # --- TL;DR line (color coded by risk) ---
    tldr_map = {
        "CRITICAL": f"🔴 CRITICAL RISK: {name} shows severe fraud signals — do not invest without deep investigation.",
        "HIGH":     f"🟠 HIGH RISK: {name} has significant warning signs — caution strongly advised.",
        "MODERATE": f"🟡 MODERATE RISK: {name} has some concerns — monitor closely before investing.",
        "LOW":      f"🟢 LOW RISK: {name} shows a generally healthy financial profile — routine monitoring advised.",
    }
    tldr = tldr_map.get(risk_level, tldr_map["MODERATE"])

    # --- Revenue narrative ---
    rev_str = ""
    if revenue and len(revenue) >= 2:
        valid = [(y, r) for y, r in zip(years, revenue) if r is not None]
        if len(valid) >= 2:
            first_r, last_r = valid[0][1], valid[-1][1]
            if first_r > 0:
                change = ((last_r - first_r) / first_r) * 100
                direction = "grew" if change > 0 else "declined"
                rev_str = (
                    f"Revenue {direction} {abs(change):.0f}% "
                    f"({valid[0][0]}→{valid[-1][0]}), "
                    f"moving from {_format_large_number(first_r)} to {_format_large_number(last_r)}. "
                )

    # --- Profit narrative ---
    profit_str = ""
    if profit:
        neg_years = [y for y, p in zip(years, profit) if p is not None and p < 0]
        valid_p   = [p for p in profit if p is not None]
        if neg_years:
            profit_str = f"Net losses recorded in {', '.join(neg_years)} — a serious concern. "
        elif len(valid_p) >= 2 and valid_p[-1] > valid_p[0]:
            pct = ((valid_p[-1] - valid_p[0]) / abs(valid_p[0])) * 100
            profit_str = f"Net profit grew {pct:.0f}% over the period. "
        else:
            profit_str = "Profitability has been maintained across reported periods. "

    # --- Debt narrative ---
    debt_str = ""
    if debt:
        latest_d = next((d for d in reversed(debt) if d is not None), None)
        latest_r = next((r for r in reversed(revenue) if r is not None), None) if revenue else None
        if latest_d is not None:
            debt_str = f"Total debt stands at {_format_large_number(latest_d)}"
            if latest_r and latest_r > 0:
                ratio = latest_d / latest_r
                debt_str += f" ({ratio:.1f}x revenue)"
                if ratio > 1.5:
                    debt_str += " — dangerously high leverage"
                elif ratio > 0.8:
                    debt_str += " — elevated but manageable"
                else:
                    debt_str += " — within safe range"
            debt_str += ". "

    # --- Top risk flags ---
    flag_str = ""
    if flags:
        top_flags = flags[:2]
        flag_str = "Key risks: " + " | ".join(top_flags) + ". "

    # --- Margin note ---
    margin_str = ""
    if margin is not None:
        margin_str = f"Net margin of {margin*100:.1f}%. "
        if margin < 0:
            margin_str = f"⚠️ Negative net margin ({margin*100:.1f}%) — company is losing money on operations. "
        elif margin < 0.05:
            margin_str = f"Very thin margin ({margin*100:.1f}%) — vulnerable to any cost increase. "

    # --- Investor action line ---
    action_map = {
        "CRITICAL": "🚫 Investor Action: AVOID — immediate exit or do not enter until situation resolves.",
        "HIGH":     "⚠️ Investor Action: INVESTIGATE — get audited financials and management explanation before any position.",
        "MODERATE": "👁️ Investor Action: WATCH — hold if already invested, but do not increase exposure without monitoring.",
        "LOW":      "✅ Investor Action: SAFE to consider — continue routine monitoring of quarterly results.",
    }
    action = action_map.get(risk_level, action_map["MODERATE"])

    # --- Assemble full summary ---
    body = (
        f"{name} ({sector} / {industry}) — {len(years)}-year analysis. "
        f"{rev_str}{profit_str}{margin_str}{debt_str}{flag_str}"
    )

    return {
        "tldr":   tldr,
        "body":   body,
        "action": action,
        "score":  score,
        "level":  risk_level,
    }
