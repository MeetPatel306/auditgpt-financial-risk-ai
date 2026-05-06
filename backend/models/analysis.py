from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class AnalysisRecord(BaseModel):
    """Full analysis record stored in MongoDB."""
    userId: str
    company: str
    nse_symbol: str
    fraud_score: int
    risk_level: str
    financial_data: dict  # Full analysis response payload
    createdAt: str


class AnalysisHistoryItem(BaseModel):
    """Lightweight model for history listing."""
    id: str
    company: str
    nse_symbol: str
    fraud_score: int
    risk_level: str
    createdAt: str


class AnalysisDetailResponse(BaseModel):
    """Full analysis detail returned from history."""
    id: str
    company: str
    nse_symbol: str
    fraud_score: int
    risk_level: str
    financial_data: dict
    createdAt: str
