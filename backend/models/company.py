from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CompanyRequest(BaseModel):
    company_name: str

class AnomalyFlag(BaseModel):
    month: str
    type: str

class TrendPoint(BaseModel):
    month: str
    value: int
    anomaly: bool

class RiskCategory(BaseModel):
    category: str
    score: int

class Financials(BaseModel):
    total_revenue: int
    total_expenses: int
    anomalies_detected: int
    periods_reviewed: int
    data_completeness: int

class AnalysisResponse(BaseModel):
    company_name: str
    analyzed_at: str
    fraud_score: int
    risk_level: str
    risk_color: str
    summary: str
    red_flags: list[str]
    revenue_trend: list[TrendPoint]
    expense_trend: list[TrendPoint]
    anomaly_flags: list[AnomalyFlag]
    risk_categories: list[RiskCategory]
    financials: Financials
