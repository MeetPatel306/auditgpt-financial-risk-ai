"""
Analysis Router — FIXED VERSION
Fix 1: Returns data_warning and data_quality fields to frontend
Fix 2: Returns score_explanations for each dimension
Fix 5: SEBI/BSE alert check integrated
Fix 6: Summary now returns structured dict with tldr/body/action
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from services.yahoo_finance import fetch_company_data, get_score_explanation
from services.nse_validator import (
    validate_nse_company,
    search_nse_companies,
    classify_symbol,
    refresh_nse_list_from_website,
)
from services.live_price import get_live_price
from database import analyses_collection

router = APIRouter()
optional_security = HTTPBearer(auto_error=False)


class CompanyRequest(BaseModel):
    company_name: str


async def _get_user_email(credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    if not credentials:
        return None
    try:
        from services.auth import JWT_SECRET, JWT_ALGORITHM
        from jose import JWTError, jwt as jose_jwt
        from database import users_collection

        payload = jose_jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email   = payload.get("sub")
        if not email:
            return None
        user = await users_collection.find_one({"email": email})
        return user["email"] if user else None
    except Exception:
        return None


@router.post("/analyze-company")
async def analyze_company(
    request: CompanyRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
):
    if not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")

    # FIX 1: Validate and classify the symbol
    query = request.company_name.strip()
    matched = validate_nse_company(query)
    if not matched:
        # Retry once after refreshing latest NSE list.
        refresh_nse_list_from_website()
        matched = validate_nse_company(query)

    if not matched:
        # Graceful fallback: if symbol-like query has live market data, return it.
        upper = query.upper().strip()
        live_data = get_live_price(upper)
        if live_data:
            return {
                "success": False,
                "message": (
                    "Financial history unavailable for this company right now. "
                    "Showing live market data only."
                ),
                "company_name": upper,
                "nse_symbol": upper,
                "live_only": True,
                "live_price": live_data,
            }
        return {
            "success": False,
            "message": (
                f"'{request.company_name}' not found on NSE. "
                "Try company symbol/name again; newly listed companies may need refresh."
            ),
            "company_name": request.company_name,
        }

    # FIX 1: Check classification and warn about SME/DVR before fetching
    classification = matched.get("classification", {})
    symbol_type    = classification.get("type", "normal")

    try:
        result = fetch_company_data(matched["symbol"])
        result["nse_symbol"]      = matched["symbol"]
        result["symbol_type"]     = symbol_type

        # For very short history, show live market only (no fragile fraud score).
        if result.get("data_quality") in {"partial", "insufficient"}:
            live_data = result.get("live_price") or get_live_price(matched["symbol"])
            return {
                "success": False,
                "message": (
                    result.get("data_warning")
                    or "Limited financial history available. Showing live market data only."
                ),
                "company_name": result.get("company_name", matched.get("name", matched["symbol"])),
                "nse_symbol": matched["symbol"],
                "live_only": True,
                "data_quality": result.get("data_quality"),
                "live_price": live_data or None,
            }

        # FIX 2: Add score explanations for each dimension
        score_breakdown = result.get("fraud_details", {}).get("score_breakdown", {})
        risk_categories = result.get("risk_categories", [])
        result["score_explanations"] = get_score_explanation(score_breakdown, risk_categories)

        # FIX 6: If summary is now a dict, keep it — otherwise wrap legacy string
        if isinstance(result.get("summary"), str):
            result["summary"] = {
                "tldr":   result["summary"][:120],
                "body":   result["summary"],
                "action": "Monitor regularly.",
                "score":  result.get("fraud_score", 0),
                "level":  result.get("risk_level", "MODERATE"),
            }

        # Save to history if authenticated
        user_email = await _get_user_email(credentials)
        if user_email:
            analysis_doc = {
                "userId":       user_email,
                "company":      result.get("company_name", matched["symbol"]),
                "nse_symbol":   matched["symbol"],
                "fraud_score":  result.get("fraud_score", 0),
                "risk_level":   result.get("risk_level", "Unknown"),
                "data_quality": result.get("data_quality", "unknown"),
                "financial_data": result,
                "createdAt":    datetime.utcnow().isoformat(),
            }
            await analyses_collection.insert_one(analysis_doc)

        return result

    except HTTPException:
        raise
    except ValueError as e:
        if "Data unavailable" in str(e):
            live_data = get_live_price(matched["symbol"])
            return {
                "success": False,
                "message": "Data unavailable",
                "nse_symbol": matched["symbol"],
                "company_name": matched.get("name", matched["symbol"]),
                "live_only": bool(live_data),
                "live_price": live_data or None,
            }
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch financial data for {matched['symbol']}: {str(e)}"
        )


@router.get("/nse/search")
async def nse_search(q: str = ""):
    """
    Search NSE companies for autocomplete.
    FIX 1: Now returns symbol type (normal/sme/dvr) for UI badges.
    """
    results = search_nse_companies(q, limit=8)
    if not results and q.strip():
        refresh_nse_list_from_website()
        results = search_nse_companies(q, limit=8)
    return results


@router.get("/nse/classify/{symbol}")
async def classify_symbol_endpoint(symbol: str):
    """
    Classify a symbol before analysis — tells frontend what type it is.
    Frontend can show warnings before user clicks Analyze.
    """
    classification = classify_symbol(symbol.upper())
    return {
        "symbol":         symbol.upper(),
        "classification": classification,
    }