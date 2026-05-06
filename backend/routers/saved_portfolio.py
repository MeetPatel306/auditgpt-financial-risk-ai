"""
Saved Portfolio endpoints — persistent company watchlist backed by MongoDB.

POST /api/portfolio/add     — add company symbols to the user's saved portfolio
GET  /api/portfolio         — retrieve the user's saved portfolio
DELETE /api/portfolio/remove — remove a company from the saved portfolio
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from datetime import datetime

from services.auth import get_current_user
from services.nse_validator import validate_nse_company
from database import portfolios_collection

router = APIRouter()


class AddRequest(BaseModel):
    symbols: List[str]  # e.g. ["TCS", "INFY"]


class RemoveRequest(BaseModel):
    symbol: str  # e.g. "TCS"


MAX_PORTFOLIO_SIZE = 20


@router.post("/portfolio/add")
async def add_to_portfolio(req: AddRequest, current_user: dict = Depends(get_current_user)):
    """Add one or more NSE symbols to the user's saved portfolio."""
    if not req.symbols:
        raise HTTPException(status_code=400, detail="No symbols provided")

    # Validate each symbol against NSE
    valid_symbols = []
    invalid_symbols = []
    for sym in req.symbols:
        s = sym.strip().upper()
        if not s:
            continue
        matched = validate_nse_company(s)
        if matched:
            valid_symbols.append(matched["symbol"])
        else:
            invalid_symbols.append(s)

    if not valid_symbols:
        raise HTTPException(
            status_code=400,
            detail=f"No valid NSE symbols found. Invalid: {', '.join(invalid_symbols)}"
        )

    user_email = current_user["email"]
    now = datetime.utcnow().isoformat()

    # Upsert: create portfolio if doesn't exist, add symbols via $addToSet
    existing = await portfolios_collection.find_one({"userId": user_email})
    current_count = len(existing["companies"]) if existing else 0

    # Check limit
    new_unique = [s for s in valid_symbols if not existing or s not in existing.get("companies", [])]
    if current_count + len(new_unique) > MAX_PORTFOLIO_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Portfolio limit is {MAX_PORTFOLIO_SIZE} companies. "
                   f"Currently {current_count}, trying to add {len(new_unique)} new."
        )

    await portfolios_collection.update_one(
        {"userId": user_email},
        {
            "$addToSet": {"companies": {"$each": valid_symbols}},
            "$set": {"updatedAt": now},
            "$setOnInsert": {"userId": user_email, "createdAt": now},
        },
        upsert=True,
    )

    # Fetch updated doc
    updated = await portfolios_collection.find_one({"userId": user_email})

    return {
        "added": valid_symbols,
        "invalid": invalid_symbols,
        "companies": updated["companies"],
        "total": len(updated["companies"]),
    }


@router.get("/portfolio")
async def get_portfolio(current_user: dict = Depends(get_current_user)):
    """Return the user's saved portfolio."""
    user_email = current_user["email"]
    doc = await portfolios_collection.find_one({"userId": user_email})

    if not doc:
        return {"companies": [], "total": 0}

    return {
        "companies": doc.get("companies", []),
        "total": len(doc.get("companies", [])),
        "updatedAt": doc.get("updatedAt"),
    }


@router.delete("/portfolio/remove")
async def remove_from_portfolio(req: RemoveRequest, current_user: dict = Depends(get_current_user)):
    """Remove a symbol from the user's saved portfolio."""
    symbol = req.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    user_email = current_user["email"]
    now = datetime.utcnow().isoformat()

    result = await portfolios_collection.update_one(
        {"userId": user_email},
        {
            "$pull": {"companies": symbol},
            "$set": {"updatedAt": now},
        },
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail=f"'{symbol}' not found in your portfolio")

    # Fetch updated doc
    updated = await portfolios_collection.find_one({"userId": user_email})

    return {
        "removed": symbol,
        "companies": updated["companies"] if updated else [],
        "total": len(updated["companies"]) if updated else 0,
    }
