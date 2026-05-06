from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId
from services.auth import get_current_user
from database import analyses_collection

router = APIRouter()


@router.get("/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    """Return all past analyses for the authenticated user, newest first."""
    user_email = current_user["email"]
    cursor = analyses_collection.find(
        {"userId": user_email},
        {
            "company": 1,
            "nse_symbol": 1,
            "fraud_score": 1,
            "risk_level": 1,
            "createdAt": 1,
        },
    ).sort("createdAt", -1)

    items = []
    async for doc in cursor:
        items.append({
            "id": str(doc["_id"]),
            "company": doc["company"],
            "nse_symbol": doc.get("nse_symbol", ""),
            "fraud_score": doc["fraud_score"],
            "risk_level": doc["risk_level"],
            "createdAt": doc["createdAt"],
        })

    return items


@router.get("/history/{record_id}")
async def get_history_detail(record_id: str, current_user: dict = Depends(get_current_user)):
    """Return the full analysis data for a specific history record."""
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid record ID")

    doc = await analyses_collection.find_one({"_id": ObjectId(record_id)})

    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")

    # Ensure the record belongs to the requesting user
    if doc["userId"] != current_user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id": str(doc["_id"]),
        "company": doc["company"],
        "nse_symbol": doc.get("nse_symbol", ""),
        "fraud_score": doc["fraud_score"],
        "risk_level": doc["risk_level"],
        "financial_data": doc["financial_data"],
        "createdAt": doc["createdAt"],
    }


@router.delete("/history/{record_id}")
async def delete_history(record_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific history record (only if owned by the user)."""
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid record ID")

    doc = await analyses_collection.find_one({"_id": ObjectId(record_id)})

    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")

    if doc["userId"] != current_user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")

    await analyses_collection.delete_one({"_id": ObjectId(record_id)})

    return {"detail": "Record deleted", "id": record_id}
