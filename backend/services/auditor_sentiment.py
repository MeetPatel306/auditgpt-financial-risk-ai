"""
Auditor Sentiment Analysis Engine for AuditGPT.

Two-step process:
  1. Generate realistic per-year auditor note text from financial data.
  2. Run NLP sentiment scoring using a financial-domain weighted lexicon.

Returns a list of yearly sentiment readings:
  [
    {
      "year":       "2022",
      "sentiment":  "positive" | "neutral" | "negative",
      "score":      float  -1.0 to +1.0,
      "label":      "Positive" | "Neutral" | "Negative",
      "note":       str   (simulated auditor note),
      "risk_flag":  bool,
      "keywords":   list[str]  (matched sentiment words),
    },
    ...
  ]
"""

from __future__ import annotations
import re


# ─── Financial NLP Lexicon ────────────────────────────────────────────────────
# Weighted keyword lists tuned for auditor/financial report language.
# Each entry: (word_or_phrase, weight)  — positive weight = positive sentiment.

POSITIVE_LEXICON: list[tuple[str, float]] = [
    ("unqualified opinion",      2.0),
    ("clean opinion",            2.0),
    ("true and fair",            1.8),
    ("no material weakness",     1.8),
    ("adequate internal controls", 1.6),
    ("strong cash generation",   1.5),
    ("consistent revenue growth", 1.4),
    ("improving margins",        1.4),
    ("healthy liquidity",        1.4),
    ("free cash flow positive",  1.3),
    ("debt reduction",           1.3),
    ("profitability maintained", 1.2),
    ("sound financial position", 1.2),
    ("compliant with standards", 1.1),
    ("effective governance",     1.1),
    ("dividend maintained",      1.0),
    ("improved profitability",   1.0),
    ("positive",                 0.7),
    ("growth",                   0.6),
    ("stable",                   0.6),
    ("efficient",                0.5),
    ("adequate",                 0.5),
    ("profitable",               0.6),
    ("sustainable",              0.5),
]

NEGATIVE_LEXICON: list[tuple[str, float]] = [
    ("qualified opinion",        -2.5),
    ("adverse opinion",          -3.0),
    ("disclaimer of opinion",    -3.0),
    ("material weakness",        -2.5),
    ("going concern",            -2.8),
    ("significant doubt",        -2.2),
    ("inability to continue",    -2.5),
    ("substantial doubt",        -2.2),
    ("restatement",              -2.0),
    ("fraud detected",           -3.0),
    ("misstatement",             -2.0),
    ("non-compliance",           -1.8),
    ("inadequate disclosure",    -1.6),
    ("negative cash flow",       -1.5),
    ("cash burn",                -1.4),
    ("revenue decline",          -1.3),
    ("losses reported",          -1.3),
    ("debt covenant breach",     -2.0),
    ("impairment",               -1.2),
    ("provision for bad debts",  -1.1),
    ("declining margins",        -1.2),
    ("increased borrowings",     -0.9),
    ("concern",                  -0.8),
    ("doubt",                    -0.9),
    ("risk",                     -0.4),
    ("uncertainty",              -0.7),
    ("weakening",                -0.8),
    ("deteriorating",            -1.0),
    ("negative",                 -0.6),
    ("loss",                     -0.8),
    ("defaulted",                -1.5),
]

# Compile for fast substring matching
def _build_matcher(lexicon):
    return [(phrase, weight) for phrase, weight in lexicon]


POS_MATCHER = _build_matcher(POSITIVE_LEXICON)
NEG_MATCHER = _build_matcher(NEGATIVE_LEXICON)


# ─── Auditor Note Generator ───────────────────────────────────────────────────

def _fmt(v: float | None) -> str:
    if v is None:
        return "N/A"
    abs_v = abs(v)
    sign  = "-" if v < 0 else ""
    if abs_v >= 1e12:
        return f"{sign}₹{abs_v/1e12:.2f}T"
    if abs_v >= 1e9:
        return f"{sign}₹{abs_v/1e9:.2f}B"
    if abs_v >= 1e7:
        return f"{sign}₹{abs_v/1e7:.2f}Cr"
    return f"{sign}₹{abs_v/1e5:.1f}L"


def _generate_auditor_note(
    year: str,
    revenue: float | None,
    profit:  float | None,
    debt:    float | None,
    cashflow: float | None,
    prev_revenue: float | None = None,
    prev_profit:  float | None = None,
) -> str:
    """
    Synthesize a realistic auditor note for one year based on
    the company's actual financial data.
    """
    parts = [f"Auditor's Note — Financial Year {year}:"]

    # ── Revenue commentary ──────────────────────────────────────────────────
    if revenue is not None:
        if prev_revenue is not None and prev_revenue > 0:
            rev_change = (revenue - prev_revenue) / prev_revenue * 100
            if rev_change > 20:
                parts.append(
                    f"The entity recorded consistent revenue growth of {rev_change:.1f}% "
                    f"to {_fmt(revenue)}, reflecting strong business momentum and expanding operations."
                )
            elif rev_change > 5:
                parts.append(
                    f"Revenues grew {rev_change:.1f}% year-over-year to {_fmt(revenue)}, "
                    f"indicating stable and improving financial position."
                )
            elif rev_change >= 0:
                parts.append(
                    f"Revenue was broadly stable at {_fmt(revenue)} ({rev_change:+.1f}% vs prior year)."
                )
            else:
                parts.append(
                    f"Revenue declined {abs(rev_change):.1f}% to {_fmt(revenue)}, "
                    f"a trend requiring attention and adequate disclosure by management."
                )
        else:
            parts.append(f"Total revenues for the period stand at {_fmt(revenue)}.")

    # ── Profitability commentary ─────────────────────────────────────────────
    if profit is not None:
        if profit > 0:
            if prev_profit is not None and prev_profit > 0:
                prf_change = (profit - prev_profit) / prev_profit * 100
                if prf_change > 0:
                    parts.append(
                        f"Profitability maintained with net profit of {_fmt(profit)} "
                        f"({prf_change:+.1f}%). Margins are improving, reflecting operational efficiency."
                    )
                else:
                    parts.append(
                        f"Net profit stands at {_fmt(profit)}, showing declining margins "
                        f"of {prf_change:.1f}% vs prior year. Management should address cost pressures."
                    )
            else:
                parts.append(
                    f"Net profit of {_fmt(profit)} was recorded, indicating the company is profitable."
                )
        else:
            parts.append(
                f"The entity reported a net loss of {_fmt(abs(profit))}. "
                f"Losses reported raise significant concern about the sustainability of operations "
                f"and may have implications for going concern assessment."
            )

    # ── Cash flow commentary ─────────────────────────────────────────────────
    if cashflow is not None:
        if cashflow >= 0:
            parts.append(
                f"Free cash flow positive at {_fmt(cashflow)}, demonstrating healthy liquidity "
                f"and adequate internal cash generation relative to operational requirements."
            )
        else:
            parts.append(
                f"Operating cash flow was negative at {_fmt(cashflow)}, indicating cash burn "
                f"and raising concerns regarding the entity's short-term liquidity position."
            )

    # ── Debt commentary ──────────────────────────────────────────────────────
    if debt is not None and revenue is not None and revenue > 0:
        dr = debt / revenue
        if dr > 2:
            parts.append(
                f"Total debt of {_fmt(debt)} results in a debt-to-revenue ratio of {dr:.1f}x. "
                f"This level of debt creates significant doubt about the entity's capacity "
                f"to service obligations without restructuring."
            )
        elif dr > 1:
            parts.append(
                f"Debt stands at {_fmt(debt)} ({dr:.1f}x revenue). Increased borrowings observed; "
                f"management attention to leverage is warranted."
            )
        elif dr > 0.3:
            parts.append(
                f"Total debt of {_fmt(debt)} ({dr:.1f}x revenue) is within manageable bounds. "
                f"No immediate debt covenant risk identified."
            )
        else:
            parts.append(
                f"The entity maintains a sound financial position with modest debt of {_fmt(debt)} ({dr:.1f}x revenue)."
            )

    # ── Closing opinion ──────────────────────────────────────────────────────
    # Determine if we need a qualified or clean opinion
    has_loss   = profit is not None and profit < 0
    has_neg_cf = cashflow is not None and cashflow < 0
    high_debt  = (debt is not None and revenue is not None and revenue > 0 and debt / revenue > 2)

    if has_loss and has_neg_cf:
        parts.append(
            "In our opinion, the financial statements present a qualified opinion. "
            "Going concern uncertainty exists given concurrent losses and negative cash flows."
        )
    elif has_loss or high_debt:
        parts.append(
            "In our opinion, the financial statements are presented fairly; however, "
            "certain material weaknesses and risk factors warrant enhanced disclosure."
        )
    else:
        parts.append(
            "In our opinion, the financial statements present a true and fair view "
            "in conformity with applicable accounting standards. Unqualified opinion issued."
        )

    return " ".join(parts)


# ─── Sentiment Scorer ─────────────────────────────────────────────────────────

def _score_note(note: str) -> tuple[float, list[str]]:
    """
    Score a note using the financial lexicon.
    Returns (score, matched_keywords).
    score ranges: -1.0 (very negative) to +1.0 (very positive).
    """
    text = note.lower()
    total_weight = 0.0
    matched = []

    for phrase, weight in POS_MATCHER:
        if phrase in text:
            total_weight += weight
            matched.append(phrase)

    for phrase, weight in NEG_MATCHER:
        if phrase in text:
            total_weight += weight  # weight is negative for negative phrases
            matched.append(phrase)

    # Normalise to -1..+1 using tanh
    import math
    score = math.tanh(total_weight / 3.0)

    return round(score, 3), matched


def _label(score: float) -> str:
    if score > 0.15:
        return "positive"
    if score < -0.15:
        return "negative"
    return "neutral"


# ─── Public API ───────────────────────────────────────────────────────────────

def analyze_auditor_sentiment(
    years: list[str],
    revenue: list,
    profit: list,
    debt: list,
    cashflow: list,
) -> dict:
    """
    Run per-year auditor sentiment analysis.

    Returns:
      {
        "yearly": list of yearly sentiment dicts,
        "overall_sentiment": str,
        "trend": "improving" | "stable" | "deteriorating",
        "risk_flag": bool,
        "risk_reason": str | None,
      }
    """
    if not years:
        return {
            "yearly": [],
            "overall_sentiment": "neutral",
            "trend": "stable",
            "risk_flag": False,
            "risk_reason": None,
        }

    yearly = []

    for i, year in enumerate(years):
        rev = revenue[i] if i < len(revenue) else None
        prf = profit[i]  if i < len(profit)  else None
        dbt = debt[i]    if i < len(debt)     else None
        cf  = cashflow[i] if i < len(cashflow) else None

        prev_rev = revenue[i - 1] if i > 0 and i - 1 < len(revenue) else None
        prev_prf = profit[i - 1]  if i > 0 and i - 1 < len(profit)  else None

        note  = _generate_auditor_note(year, rev, prf, dbt, cf, prev_rev, prev_prf)
        score, keywords = _score_note(note)
        sentiment = _label(score)

        # sentiment_score for chart: map to 0-100 range (50 = neutral)
        chart_score = round((score + 1) / 2 * 100, 1)

        yearly.append({
            "year":        year,
            "sentiment":   sentiment,
            "score":       score,
            "chart_score": chart_score,   # 0-100 for easier charting
            "label":       sentiment.capitalize(),
            "note":        note,
            "risk_flag":   sentiment == "negative",
            "keywords":    keywords[:6],  # top matched keywords
        })

    # ── Overall trend ─────────────────────────────────────────────────────────
    scores = [y["score"] for y in yearly]
    overall_avg = sum(scores) / len(scores) if scores else 0
    overall_sentiment = _label(overall_avg)

    # Trend: compare first half vs second half
    mid = len(scores) // 2
    if mid > 0:
        first_half  = sum(scores[:mid])  / mid
        second_half = sum(scores[mid:])  / (len(scores) - mid)
        delta = second_half - first_half
        trend = "improving" if delta > 0.1 else "deteriorating" if delta < -0.1 else "stable"
    else:
        trend = "stable"

    # ── Risk flag ─────────────────────────────────────────────────────────────
    neg_years = [y["year"] for y in yearly if y["sentiment"] == "negative"]
    risk_flag = len(neg_years) > 0

    # Check for deteriorating trend (last 2 years negative)
    if len(yearly) >= 2 and all(y["sentiment"] == "negative" for y in yearly[-2:]):
        risk_reason = (
            f"Auditor sentiment has been negative for 2+ consecutive years "
            f"({', '.join(neg_years[-2:])}). This persistent negative tone signals "
            f"elevated audit risk and warrants immediate investigation."
        )
    elif neg_years:
        risk_reason = (
            f"Negative auditor sentiment detected in {', '.join(neg_years)}. "
            f"Flagged language includes: {', '.join(yearly[[y['year'] for y in yearly].index(neg_years[0])]['keywords'][:3])}."
        )
    else:
        risk_reason = None

    return {
        "yearly":             yearly,
        "overall_sentiment":  overall_sentiment,
        "trend":              trend,
        "risk_flag":          risk_flag,
        "risk_reason":        risk_reason,
        "neg_years":          neg_years,
    }
