"""
POST /api/generate-report — AI narrative report generation.

Two endpoints:
  POST /api/generate-report         → JSON { summary, model }
  POST /api/generate-report/stream  → SSE token stream for typewriter effect
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any, Optional, List, Dict
import json
import asyncio

from services.ai_report import generate_ai_report

router = APIRouter()


class ReportRequest(BaseModel):
    # Full analysis payload forwarded from the frontend
    company_name: str
    nse_symbol: Optional[str] = None
    fraud_score: Optional[int] = None
    risk_level: Optional[str] = None
    years: Optional[list] = None
    revenue_10y: Optional[list] = None
    profit_10y: Optional[list] = None
    debt_10y: Optional[list] = None
    cashflow_10y: Optional[list] = None
    company_info: Optional[dict] = None
    fraud_details: Optional[dict] = None
    comparison: Optional[dict] = None
    # Allow any additional keys
    model_config = {"extra": "allow"}


@router.post("/generate-report")
async def generate_report(req: ReportRequest):
    """
    Generate an AI narrative report synchronously.
    Returns { summary, model }.
    """
    payload = req.model_dump()
    result  = generate_ai_report(payload)
    return {
        "summary": result["summary"],
        "model":   result["model"],
    }


@router.post("/generate-report/stream")
async def generate_report_stream(req: ReportRequest):
    """
    Stream the AI report token-by-token using SSE.
    Each event is: data: <token>\n\n
    Final event:   data: [DONE]|<model>\n\n
    """
    payload = req.model_dump()

    async def event_generator():
        result = generate_ai_report(payload)
        text   = result["summary"]
        model  = result["model"]

        # Stream character-by-character with small delay for natural feel
        # For OpenAI we already have the full text; simulate streaming
        CHUNK = 4  # chars per tick
        delay = 0.012  # seconds

        for i in range(0, len(text), CHUNK):
            chunk = text[i:i + CHUNK]
            # Escape newlines for SSE
            chunk_encoded = chunk.replace("\n", "\\n")
            yield f"data: {chunk_encoded}\n\n"
            await asyncio.sleep(delay)

        # Signal completion with model info
        yield f"data: [DONE]|{model}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
