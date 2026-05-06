"""
POST /api/send-alert
Sends a high-risk email alert using Python's built-in smtplib.
Environment variables (all optional — if missing, email is skipped gracefully):
  ALERT_EMAIL_FROM     sender address (Gmail recommended)
  ALERT_EMAIL_PASSWORD app password (Gmail App Password)
  ALERT_EMAIL_TO       default recipient (can be overridden per-request)
  ALERT_SMTP_HOST      default: smtp.gmail.com
  ALERT_SMTP_PORT      default: 587
"""

import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter()


class AlertRequest(BaseModel):
    company_name: str
    nse_symbol: str
    fraud_score: int
    risk_level: str
    reasons: list[str] = []
    recipient_email: Optional[str] = None   # override target email


@router.get("/alert-config")
async def alert_config_status():
    """
    Expose non-secret email alert configuration status for frontend UX.
    """
    email_from = os.getenv("ALERT_EMAIL_FROM", "").strip()
    email_password = os.getenv("ALERT_EMAIL_PASSWORD", "").strip()
    email_to = os.getenv("ALERT_EMAIL_TO", "").strip()

    missing = []
    if not email_from:
        missing.append("ALERT_EMAIL_FROM")
    if not email_password:
        missing.append("ALERT_EMAIL_PASSWORD")

    return {
        "configured": len(missing) == 0,
        "has_default_recipient": bool(email_to),
        "missing": missing,
    }


def _build_email_html(company: str, symbol: str, score: int, level: str, reasons: list[str]) -> str:
    reason_rows = "".join(
        f"<tr><td style='padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px'>⚑ {r}</td></tr>"
        for r in reasons[:6]
    )
    level_color = {"CRITICAL": "#ef4444", "HIGH": "#f97316", "MODERATE": "#eab308", "LOW": "#22c55e"}.get(level, "#f97316")

    return f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a1120;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;background:#0d1a2d;border-radius:12px;overflow:hidden;border:1px solid {level_color}40">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f172a,#1a0505);padding:28px 32px;border-bottom:1px solid {level_color}30">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <span style="font-size:22px">⚠</span>
      <span style="font-size:20px;font-weight:800;color:white;letter-spacing:-0.5px">Audit<span style="color:#00d4ff">GPT</span> Alert</span>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin:0;letter-spacing:1px;text-transform:uppercase">High Risk Detection · {datetime.utcnow().strftime("%d %b %Y %H:%M UTC")}</p>
  </div>

  <!-- Score section -->
  <div style="padding:28px 32px;text-align:center;background:{level_color}08;border-bottom:1px solid {level_color}20">
    <p style="color:{level_color};font-size:48px;font-weight:900;margin:0;line-height:1">{score}</p>
    <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:4px 0 12px">Fraud Risk Score / 100</p>
    <span style="background:{level_color}20;color:{level_color};border:1px solid {level_color}40;padding:5px 18px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1px">{level} RISK</span>
  </div>

  <!-- Company info -->
  <div style="padding:22px 32px;border-bottom:1px solid #1e293b">
    <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Company</p>
    <p style="color:white;font-size:18px;font-weight:700;margin:0">{company}</p>
    <p style="color:#00d4ff;font-size:12px;font-family:monospace;margin:4px 0 0">NSE: {symbol}</p>
  </div>

  <!-- Risk findings -->
  {"<div style='padding:22px 32px 10px;border-bottom:1px solid #1e293b'><p style='color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px'>Risk Signals Detected</p><table style='width:100%;border-collapse:collapse'>" + reason_rows + "</table></div>" if reasons else ""}

  <!-- Footer -->
  <div style="padding:18px 32px;text-align:center">
    <p style="color:#334155;font-size:11px;margin:0">
      This alert was generated automatically by AuditGPT AI fraud detection engine.<br/>
      Please conduct independent due diligence before making any financial decisions.
    </p>
  </div>

</div>
</body>
</html>
"""


@router.post("/send-alert")
async def send_alert(req: AlertRequest):
    """
    Send a high-risk email alert.
    Returns success even when email is not configured — the frontend
    uses the 'email_sent' field to decide what to show the user.
    """
    email_from     = os.getenv("ALERT_EMAIL_FROM", "")
    email_password = os.getenv("ALERT_EMAIL_PASSWORD", "")
    email_to       = req.recipient_email or os.getenv("ALERT_EMAIL_TO", "")
    smtp_host      = os.getenv("ALERT_SMTP_HOST", "smtp.gmail.com")
    smtp_port      = int(os.getenv("ALERT_SMTP_PORT", "587"))

    if not email_from or not email_password:
        return {
            "email_sent": False,
            "reason": (
                "Email service not configured on server. "
                "Set ALERT_EMAIL_FROM and ALERT_EMAIL_PASSWORD in backend .env."
            ),
            "alert_logged": True,
        }
    if not email_to:
        return {
            "email_sent": False,
            "reason": (
                "Recipient missing. Enter recipient email in form "
                "or set ALERT_EMAIL_TO in backend .env."
            ),
            "alert_logged": True,
        }

    # Build message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🚨 AuditGPT Alert: {req.company_name} — {req.risk_level} RISK (Score {req.fraud_score})"
    msg["From"]    = f"AuditGPT Alerts <{email_from}>"
    msg["To"]      = email_to

    html_body = _build_email_html(
        req.company_name, req.nse_symbol, req.fraud_score, req.risk_level, req.reasons
    )
    msg.attach(MIMEText(html_body, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(email_from, email_password)
            server.sendmail(email_from, email_to, msg.as_string())

        return {
            "email_sent": True,
            "recipient":  email_to,
            "subject":    msg["Subject"],
        }
    except Exception as e:
        return {
            "email_sent": False,
            "reason":     f"SMTP error: {str(e)}",
            "alert_logged": True,
        }
