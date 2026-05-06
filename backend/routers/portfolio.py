"""
POST /api/analyze-portfolio
Analyzes multiple NSE companies in parallel and returns a portfolio risk summary.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import asyncio

from services.yahoo_finance import fetch_company_data
from services.nse_validator import validate_nse_company

router = APIRouter()


class PortfolioRequest(BaseModel):
    companies: List[str]   # list of company names or NSE symbols


def _risk_to_score(risk_level: str) -> int:
    """Map risk level string → numeric 0-100 for averaging."""
    return {"LOW": 20, "MODERATE": 50, "HIGH": 75, "CRITICAL": 95}.get(risk_level, 50)


def _score_to_risk(score: float) -> str:
    if score >= 80: return "CRITICAL"
    if score >= 60: return "HIGH"
    if score >= 35: return "MODERATE"
    return "LOW"


async def _analyze_one(company_name: str) -> dict:
    """
    Validate and analyze a single company.
    Returns a dict with either 'error' or full analysis data.
    """
    matched = validate_nse_company(company_name.strip())
    if not matched:
        return {
            "input":   company_name,
            "symbol":  None,
            "error":   f"'{company_name}' not listed on NSE",
            "status":  "error",
        }

    symbol = matched["symbol"]
    try:
        # Run the synchronous yfinance call in a thread pool so we don't block the event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, fetch_company_data, symbol)
        result["nse_symbol"] = symbol
        result["input"]  = company_name
        result["status"] = "ok"
        return result
    except Exception as e:
        return {
            "input":  company_name,
            "symbol": symbol,
            "error":  str(e),
            "status": "error",
        }


@router.post("/analyze-portfolio")
async def analyze_portfolio(req: PortfolioRequest):
    if not req.companies:
        raise HTTPException(status_code=400, detail="No companies provided")

    if len(req.companies) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 companies per portfolio")

    # Deduplicate while preserving order
    seen = set()
    uniq = []
    for c in req.companies:
        k = c.strip().upper()
        if k and k not in seen:
            seen.add(k)
            uniq.append(c.strip())

    # Run all analyses concurrently
    results = await asyncio.gather(*[_analyze_one(c) for c in uniq])

    # ── Portfolio-level summary ───────────────────────────────────────────
    successful = [r for r in results if r.get("status") == "ok"]
    failed     = [r for r in results if r.get("status") == "error"]

    if not successful:
        raise HTTPException(
            status_code=404,
            detail="None of the provided companies could be analyzed. Check NSE symbols."
        )

    # Fraud scores & risk levels
    scores      = [r.get("fraud_score", 10) for r in successful]
    risk_levels = [r.get("risk_level", "LOW") for r in successful]

    avg_score     = round(sum(scores) / len(scores), 1)
    avg_risk      = _score_to_risk(avg_score)

    # Highest / lowest risk
    highest = max(successful, key=lambda r: r.get("fraud_score", 0))
    lowest  = min(successful, key=lambda r: r.get("fraud_score", 100))

    # Risk distribution
    dist = {"LOW": 0, "MODERATE": 0, "HIGH": 0, "CRITICAL": 0}
    for rl in risk_levels:
        dist[rl] = dist.get(rl, 0) + 1

    # Per-company summary rows (lean — strip heavy comparison/sentiment data for speed)
    company_summaries = []
    for r in successful:
        info = r.get("company_info") or {}
        company_summaries.append({
            "company_name":   r.get("company_name", r.get("input", "?")),
            "nse_symbol":     r.get("nse_symbol", ""),
            "fraud_score":    r.get("fraud_score", 0),
            "risk_level":     r.get("risk_level", "LOW"),
            "sector":         info.get("sector", "N/A"),
            "industry":       info.get("industry", "N/A"),
            "market_cap":     info.get("market_cap"),
            "pe_ratio":       info.get("pe_ratio"),
            "profit_margin":  info.get("profit_margin"),
            "roe":            info.get("roe"),
            "revenue_latest": (r.get("revenue_10y") or [None])[-1],
            "profit_latest":  (r.get("profit_10y")  or [None])[-1],
            "debt_latest":    (r.get("debt_10y")    or [None])[-1],
            "cashflow_latest":(r.get("cashflow_10y")or [None])[-1],
            "red_flags_count":len(r.get("fraud_details", {}).get("reasons", [])),
            "auditor_sentiment": r.get("auditor_sentiment", {}).get("overall_sentiment", "neutral"),
            "sentiment_trend":   r.get("auditor_sentiment", {}).get("trend", "stable"),
        })

    # Sort by fraud score descending
    company_summaries.sort(key=lambda x: x["fraud_score"], reverse=True)

    return {
        "portfolio_summary": {
            "total_companies":    len(successful),
            "failed_companies":   len(failed),
            "average_fraud_score": avg_score,
            "average_risk_level":  avg_risk,
            "highest_risk": {
                "company_name": highest.get("company_name", highest.get("input")),
                "nse_symbol":   highest.get("nse_symbol", ""),
                "fraud_score":  highest.get("fraud_score", 0),
                "risk_level":   highest.get("risk_level", "LOW"),
            },
            "lowest_risk": {
                "company_name": lowest.get("company_name", lowest.get("input")),
                "nse_symbol":   lowest.get("nse_symbol", ""),
                "fraud_score":  lowest.get("fraud_score", 0),
                "risk_level":   lowest.get("risk_level", "LOW"),
            },
            "risk_distribution": dist,
        },
        "companies":  company_summaries,
        "failed":     failed,
        "analyzed_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
