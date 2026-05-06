"""
AI Report Generation Service for AuditGPT.

Attempts to use OpenAI GPT if OPENAI_API_KEY is set.
Falls back to a high-quality local rule-based engine that produces
natural-language paragraph output (not templates).

Fix 6 (Apr 2026): the system prompt and the local-engine verdict
language have been rewritten in a sharper "senior risk-analyst" tone —
direct, evidence-led, and explicitly framed around investor exposure
and forensic-accounting red flags rather than generic recap.
"""

from __future__ import annotations
import os
import math

# ─── Format helpers ───────────────────────────────────────────────────────────

def _fmt(value: float | None, unit: str = "") -> str:
    """Format a large number as human-readable Indian notation."""
    if value is None:
        return "N/A"
    abs_v = abs(value)
    sign  = "-" if value < 0 else ""
    if abs_v >= 1e12:
        return f"{sign}₹{abs_v/1e12:.2f}T"
    if abs_v >= 1e9:
        return f"{sign}₹{abs_v/1e9:.2f}B"
    if abs_v >= 1e7:
        return f"{sign}₹{abs_v/1e7:.2f}Cr"
    if abs_v >= 1e5:
        return f"{sign}₹{abs_v/1e5:.2f}L"
    return f"{sign}{abs_v:,.0f}{unit}"


def _valid(lst: list) -> list:
    return [v for v in lst if v is not None]


def _pct(a, b) -> float | None:
    if a is None or b is None or a == 0:
        return None
    return ((b - a) / abs(a)) * 100


# ─── OpenAI path ──────────────────────────────────────────────────────────────

def _build_prompt(payload: dict) -> str:
    """Build a structured prompt string for the LLM from analysis payload.

    Tone (Fix 6):  experienced forensic / risk analyst writing for a
    portfolio manager. Plain English, no fluff, no generic advisory
    boilerplate. Numbers cited directly. Conclusions explicit.
    """
    name        = payload.get("company_name", "Unknown")
    nse         = payload.get("nse_symbol", "")
    score       = payload.get("fraud_score", 0)
    risk        = payload.get("risk_level", "UNKNOWN")
    years       = payload.get("years", [])
    revenue     = payload.get("revenue_10y", [])
    profit      = payload.get("profit_10y", [])
    debt        = payload.get("debt_10y", [])
    cashflow    = payload.get("cashflow_10y", [])
    info        = payload.get("company_info", {})
    reasons     = payload.get("fraud_details", {}).get("reason_strings", [])
    breakdown   = payload.get("fraud_details", {}).get("score_breakdown", {})
    comparison  = payload.get("comparison", {})
    reg_alerts  = payload.get("regulatory_alerts", []) or []

    # Peer comparison narrative
    peers_text = ""
    if comparison and comparison.get("peers"):
        peer_names = [p["symbol"] for p in comparison["peers"][:3]]
        input_m    = comparison.get("input_company", {})
        peer_margins = [
            p.get("profit_margin") for p in comparison["peers"]
            if p.get("profit_margin") is not None
        ]
        company_margin = input_m.get("profit_margin")
        if peer_margins and company_margin is not None:
            avg_peer = sum(peer_margins) / len(peer_margins)
            diff = company_margin - avg_peer
            direction = "above" if diff > 0 else "below"
            peers_text = (
                f"Sector peers ({', '.join(peer_names)}) average "
                f"{avg_peer:.1f}% net margin; the issuer is "
                f"{abs(diff):.1f}pp {direction} that benchmark."
            )

    # Financial data summary
    rev = _valid(revenue)
    prf = _valid(profit)
    dbt = _valid(debt)
    cf  = _valid(cashflow)

    rev_trend = ""
    if len(rev) >= 2:
        change = _pct(rev[0], rev[-1])
        if change is not None:
            verb = "compounded" if change > 0 else "contracted"
            rev_trend = (
                f"Top line {verb} {abs(change):.1f}% from "
                f"{_fmt(rev[0])} to {_fmt(rev[-1])} across "
                f"{len(years)} reporting cycles."
            )

    debt_trend = ""
    if len(dbt) >= 2:
        change = _pct(dbt[0], dbt[-1])
        if change is not None:
            verb = "expanded" if change > 0 else "wound down"
            debt_trend = (
                f"Total debt {verb} {abs(change):.1f}% to {_fmt(dbt[-1])}."
            )

    cf_trend = ""
    if cf:
        neg = sum(1 for v in cf if v < 0)
        if neg > 0:
            cf_trend = (
                f"Operating cash flow turned negative in {neg} of the "
                f"{len(cf)} reported years — a quality-of-earnings concern."
            )
        else:
            cf_trend = (
                f"Operating cash flow stayed positive across all "
                f"{len(cf)} reported years."
            )

    flags_text = ""
    if reasons:
        flags_text = "Red-flag signals on file: " + "; ".join(reasons[:5]) + "."

    reg_text = ""
    if reg_alerts:
        head = reg_alerts[0]
        reg_text = (
            f"External regulatory record: {len(reg_alerts)} item(s) — "
            f"latest: {head.get('source','')} · {head.get('title','')[:120]}."
        )

    prompt = f"""You are AuditGPT — a senior forensic / fraud-risk analyst writing
an internal note for an institutional portfolio manager who is sizing
exposure to an Indian (NSE-listed) issuer. Your reader is technical;
do NOT explain basic finance terms.

Tone & rules:
 · Write as a working risk analyst, not as a chatbot.
 · Lead every paragraph with the conclusion, then evidence.
 · Cite actual numbers (₹, %, ratios) — never "strong", "weak" without a figure.
 · Do NOT use the words "investor", "great", "amazing", "exciting".
 · Do NOT add disclaimers, caveats, or "consult a professional" language.
 · No bullet points. Three short paragraphs only. Hard cap: 220 words.

ISSUER ........... {name}  (NSE: {nse})
SECTOR ........... {info.get('sector','N/A')}  /  {info.get('industry','N/A')}
RISK SCORE ....... {score}/100   ({risk})
MARKET CAP ....... {_fmt(info.get('market_cap'))}
PE / FWD PE ...... {info.get('pe_ratio','N/A')} / {info.get('forward_pe','N/A')}
ROE / MARGIN ..... {info.get('roe','N/A')}% / {info.get('profit_margin','N/A')}%

FUNDAMENTALS
 · {rev_trend or 'Revenue series unavailable.'}
 · {debt_trend or 'Debt series unavailable.'}
 · {cf_trend or 'Cash-flow series unavailable.'}

PEER POSITION
 · {peers_text or 'No directly comparable peer set was returned.'}

INTERNAL RED FLAGS ({len(reasons)} of {len(breakdown) if breakdown else 0} categories triggered)
 · {flags_text or 'No engine-level red flags recorded.'}

EXTERNAL SIGNALS
 · {reg_text or 'No active BSE / SEBI regulatory hits.'}

DELIVERABLE
Write three short, dense paragraphs:
  1. Quality of earnings — revenue, margin, cash conversion. State whether
     reported profits are backed by cash, with the ratio.
  2. Balance-sheet & governance risk — debt trend, debt/revenue, any cash-flow
     anomalies, and the most material engine-flag.
  3. Risk verdict — restate the score, position the issuer vs peers,
     state explicit position-sizing language (one of: AVOID, REDUCE, HOLD,
     MAINTAIN) and one concrete trigger that would change your view.
"""
    return prompt


def _call_openai(prompt: str) -> str:
    """Call OpenAI GPT-4o-mini and return the text response."""
    import openai
    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a senior forensic / fraud-risk analyst at a "
                    "tier-1 Indian asset manager. You write tight, "
                    "evidence-led internal notes. You never hedge with "
                    "phrases like 'consider consulting' or 'past performance'."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=450,
        temperature=0.3,
    )
    return resp.choices[0].message.content.strip()


# ─── Local rule-based engine ──────────────────────────────────────────────────

def _local_generate(payload: dict) -> str:
    """
    High-quality local rule-based report generator.
    Produces natural, paragraph-form analysis — not templates.
    Tone re-aligned (Fix 6) with _build_prompt above: senior risk-analyst,
    no fluff, explicit position language at the end.
    """
    name      = payload.get("company_name", "the issuer")
    nse       = payload.get("nse_symbol", "")
    score     = payload.get("fraud_score", 10)
    risk      = payload.get("risk_level", "LOW")
    years     = payload.get("years", [])
    revenue   = payload.get("revenue_10y", [])
    profit    = payload.get("profit_10y", [])
    debt      = payload.get("debt_10y", [])
    cashflow  = payload.get("cashflow_10y", [])
    info      = payload.get("company_info", {})
    reasons   = payload.get("fraud_details", {}).get("reasons", [])
    breakdown = payload.get("fraud_details", {}).get("score_breakdown", {})
    comparison = payload.get("comparison", {})
    reg_alerts = payload.get("regulatory_alerts", []) or []

    rev = _valid(revenue)
    prf = _valid(profit)
    dbt = _valid(debt)
    cf  = _valid(cashflow)

    sector   = info.get("sector", "N/A")
    industry = info.get("industry", "N/A")
    pe       = info.get("pe_ratio")
    roe      = info.get("roe")
    margin   = info.get("profit_margin")
    mcap     = info.get("market_cap")

    # ── Paragraph 1: Quality of earnings ─────────────────────────────────────
    p1_parts = []
    period_str = (
        f"across {len(years)} reporting cycles ({years[0]}–{years[-1]})"
        if len(years) >= 2 else "for the reported window"
    )

    if len(rev) >= 2:
        rev_chg = _pct(rev[0], rev[-1])
        if rev_chg is not None:
            verb = "compounded" if rev_chg > 0 else "contracted"
            qualifier = ""
            if rev_chg > 50:
                qualifier = " — well above sector trend"
            elif rev_chg < 0:
                qualifier = " — a structural concern"
            p1_parts.append(
                f"{name} (NSE: {nse}) {verb} revenue {abs(rev_chg):.0f}% "
                f"{period_str}, moving from {_fmt(rev[0])} to {_fmt(rev[-1])}"
                f"{qualifier}."
            )
    else:
        p1_parts.append(f"{name} (NSE: {nse}) operates in {sector} / {industry}.")

    # Cash-conversion ratio (critical for risk analyst)
    if prf and cf and prf[-1] not in (None, 0):
        try:
            cc = cf[-1] / prf[-1] if prf[-1] else None
        except ZeroDivisionError:
            cc = None
        if cc is not None:
            if cc < 0.5:
                p1_parts.append(
                    f"Cash conversion is weak: latest operating cash flow "
                    f"covers only {cc:.2f}× reported net profit — a classic "
                    f"quality-of-earnings warning."
                )
            elif cc < 0.9:
                p1_parts.append(
                    f"Cash conversion sits at {cc:.2f}× reported net profit — "
                    f"acceptable but worth monitoring."
                )
            else:
                p1_parts.append(
                    f"Reported profits are well backed by cash "
                    f"(conversion ratio {cc:.2f}×)."
                )

    if margin is not None:
        if margin <= 0:
            p1_parts.append(
                f"Net margin of {margin:.1f}% confirms the franchise is "
                f"loss-making at the EBITDA-to-PAT bridge."
            )
        elif margin < 5:
            p1_parts.append(
                f"A {margin:.1f}% net margin leaves no buffer against "
                f"input-cost or pricing shocks."
            )
        elif margin > 20:
            p1_parts.append(
                f"A {margin:.1f}% net margin is strong for {sector} and "
                f"supports the earnings narrative."
            )

    para1 = " ".join(p1_parts)

    # ── Paragraph 2: Balance sheet + governance flags ────────────────────────
    p2_parts = []

    if len(dbt) >= 2:
        dbt_chg = _pct(dbt[0], dbt[-1])
        latest_dr = (dbt[-1] / rev[-1]) if (rev and rev[-1] and rev[-1] > 0) else None
        if dbt_chg is not None and dbt_chg > 30:
            p2_parts.append(
                f"Leverage has expanded {dbt_chg:.0f}% to {_fmt(dbt[-1])}"
                + (f" — debt/revenue now {latest_dr:.2f}×" if latest_dr else "")
                + ", outpacing the top line and tightening fixed-charge cover."
            )
        elif dbt_chg is not None and dbt_chg > 0:
            p2_parts.append(
                f"Total debt rose {dbt_chg:.0f}% to {_fmt(dbt[-1])}"
                + (f" (debt/revenue {latest_dr:.2f}×)." if latest_dr else ".")
            )
        elif dbt_chg is not None:
            p2_parts.append(
                f"Total debt was wound down {abs(dbt_chg):.0f}% to "
                f"{_fmt(dbt[-1])}, improving the balance-sheet profile."
            )

    neg_cf = sum(1 for v in cf if v < 0) if cf else 0
    if neg_cf >= 2:
        p2_parts.append(
            f"Operating cash flow printed negative in {neg_cf} of "
            f"{len(cf)} reported years — material forensic concern."
        )
    elif neg_cf == 1:
        p2_parts.append(
            "One year of negative operating cash flow on file — keep on watch."
        )

    high_severity = [r for r in reasons if r.get("severity") in ("CRITICAL", "HIGH")]
    if high_severity:
        top = high_severity[0]
        p2_parts.append(f"Most material engine-flag: {top['reason']}.")

    if reg_alerts:
        head = reg_alerts[0]
        src  = head.get("source", "regulator")
        ttl  = (head.get("title") or "")[:140]
        p2_parts.append(
            f"External hit on the regulatory tape ({src}): {ttl}."
        )

    if roe is not None:
        if roe < 0:
            p2_parts.append(
                f"ROE of {roe:.1f}% confirms shareholder capital is being eroded."
            )
        elif roe > 18:
            p2_parts.append(
                f"ROE of {roe:.1f}% is best-in-class for the sector."
            )

    para2 = " ".join(p2_parts) if p2_parts else (
        "Balance-sheet and cash-flow data were too thin for a structural read this cycle."
    )

    # ── Paragraph 3: Verdict + position language ─────────────────────────────
    p3_parts = []

    input_co   = comparison.get("input_company", {}) if comparison else {}
    peers_list = comparison.get("peers", []) if comparison else []
    highlights = comparison.get("highlights", {}) if comparison else {}

    if peers_list:
        peer_names = [p["symbol"] for p in peers_list[:3]]
        company_margin = input_co.get("profit_margin")
        peer_margins   = [p.get("profit_margin") for p in peers_list if p.get("profit_margin") is not None]

        if company_margin is not None and peer_margins:
            avg_peer = sum(peer_margins) / len(peer_margins)
            gap = company_margin - avg_peer
            if gap > 5:
                p3_parts.append(
                    f"Versus peers ({', '.join(peer_names)}), the issuer leads "
                    f"on margin by {gap:.1f}pp."
                )
            elif gap < -5:
                p3_parts.append(
                    f"Versus peers ({', '.join(peer_names)}), the issuer lags "
                    f"on margin by {abs(gap):.1f}pp."
                )
            else:
                p3_parts.append(
                    f"Margin is in line with peer set ({', '.join(peer_names)})."
                )

        if highlights.get("highest_risk") == nse:
            p3_parts.append(
                "It carries the highest engine risk score in its peer group."
            )

    # Verdict + explicit position language (risk-analyst tone)
    VERDICT = {
        "CRITICAL": (
            f"Risk score {score}/100 — CRITICAL. Position call: AVOID. "
            "Re-evaluate only after two consecutive clean reporting cycles "
            "with positive operating cash flow."
        ),
        "HIGH": (
            f"Risk score {score}/100 — HIGH. Position call: REDUCE / cap "
            "single-name exposure to <1% of book until cash conversion "
            "and debt trajectory stabilise."
        ),
        "MODERATE": (
            f"Risk score {score}/100 — MODERATE. Position call: HOLD with "
            "active monitoring; flag for review on any negative-cash-flow "
            "print or covenant news."
        ),
        "LOW": (
            f"Risk score {score}/100 — LOW. Position call: MAINTAIN. "
            "Routine quarterly review; no special diligence required."
        ),
    }
    p3_parts.append(VERDICT.get(risk, f"Risk score: {score}/100 ({risk})."))
    para3 = " ".join(p3_parts)

    return f"{para1}\n\n{para2}\n\n{para3}"


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_ai_report(payload: dict) -> dict:
    """
    Main entry point. Returns:
      {
          "summary": str,         # The generated report text
          "model":   str,         # "gpt-4o-mini" or "local"
          "paragraphs": list[str] # Split for streaming
      }
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()

    model  = "local"
    report = ""

    if api_key and api_key.startswith("sk-"):
        try:
            prompt = _build_prompt(payload)
            report = _call_openai(prompt)
            model  = "gpt-4o-mini"
        except Exception as e:
            print(f"OpenAI call failed ({e}), falling back to local engine")
            report = _local_generate(payload)
            model  = "local"
    else:
        report = _local_generate(payload)

    # Split into paragraphs for streaming
    paragraphs = [p.strip() for p in report.split("\n\n") if p.strip()]

    return {
        "summary":    report,
        "model":      model,
        "paragraphs": paragraphs,
    }
