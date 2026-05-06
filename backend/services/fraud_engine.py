"""
Advanced Fraud Detection Engine for AuditGPT.

Each check is isolated, weighted, and annotated with:
  - severity   (CRITICAL / HIGH / MEDIUM / LOW)
  - category   (what financial dimension this covers)
  - points     (contribution to fraud_score)
  - reason     (human-readable explanation)

Final output
------------
{
    "fraud_score":  int  0-100,
    "risk_level":   "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "risk_color":   hex string,
    "reasons": [
        {
            "severity":   "HIGH",
            "category":   "Cash Flow Quality",
            "points":     12,
            "reason":     "Operating cash flow is far below reported profit..."
        },
        ...
    ],
    "score_breakdown": {
        "Revenue & Growth":   int,
        "Profitability":      int,
        "Debt & Leverage":    int,
        "Cash Flow Quality":  int,
        "Peer Deviation":     int,
        "Valuation":          int,
        "Operational":        int,
    }
}
"""

from __future__ import annotations


# ── Severity colour/weight config ────────────────────────────────────────────
SEVERITY_CONFIG = {
    "CRITICAL": {"color": "#ef4444", "weight": 1.0},
    "HIGH":     {"color": "#f97316", "weight": 0.85},
    "MEDIUM":   {"color": "#eab308", "weight": 0.65},
    "LOW":      {"color": "#22c55e", "weight": 0.40},
}

RISK_LEVEL_MAP = [
    (75, "CRITICAL", "#ef4444"),
    (55, "HIGH",     "#f97316"),
    (35, "MODERATE", "#eab308"),
    (0,  "LOW",      "#22c55e"),
]


def _valid(lst: list) -> list:
    """Return non-None values from a list."""
    return [v for v in lst if v is not None]


def _pct_change(a, b) -> float | None:
    """Percentage change from a to b."""
    if a is None or b is None or a == 0:
        return None
    return ((b - a) / abs(a)) * 100


def _trend_slope(values: list[float]) -> float | None:
    """
    Compute linear slope (rise per year) via simple linear regression.
    Positive = rising, Negative = falling.
    """
    n = len(values)
    if n < 2:
        return None
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    den = sum((i - x_mean) ** 2 for i in range(n))
    return num / den if den != 0 else 0


def _is_consistently_rising(values: list[float], min_years: int = 3) -> bool:
    """True if the time-series rose for at least min_years consecutive years."""
    rises = 0
    for i in range(1, len(values)):
        if values[i] > values[i - 1]:
            rises += 1
            if rises >= min_years:
                return True
        else:
            rises = 0
    return False


def _is_consistently_falling(values: list[float], min_years: int = 2) -> bool:
    """True if the time-series fell for at least min_years consecutive years."""
    falls = 0
    for i in range(1, len(values)):
        if values[i] < values[i - 1]:
            falls += 1
            if falls >= min_years:
                return True
        else:
            falls = 0
    return False


# ──────────────────────────────────────────────────────────────────────────────
# Individual fraud checks
# Each returns a list of finding dicts (may be empty).
# ──────────────────────────────────────────────────────────────────────────────

def _check_revenue_cashflow_mismatch(revenue: list, cashflow: list) -> list:
    """
    Quality-of-earnings check: if revenue is growing but cash flow is not
    keeping pace, it suggests aggressive accrual recognition or channel stuffing.
    """
    findings = []
    rev = _valid(revenue)
    cf  = _valid(cashflow)
    if len(rev) < 2 or len(cf) < 2:
        return findings

    # Align to shorter length
    n = min(len(rev), len(cf))
    rev, cf = rev[-n:], cf[-n:]

    rev_growth = _pct_change(rev[0], rev[-1])
    cf_growth  = _pct_change(cf[0],  cf[-1])

    if rev_growth is not None and cf_growth is not None:
        divergence = rev_growth - cf_growth

        if divergence > 80:
            findings.append({
                "severity": "CRITICAL",
                "category": "Cash Flow Quality",
                "points": 18,
                "reason": (
                    f"Severe revenue-cashflow divergence: revenue grew {rev_growth:.0f}% "
                    f"but operating cash flow grew only {cf_growth:.0f}%. "
                    "This level of divergence is a key fraud indicator (Beneish M-Score pattern)."
                ),
            })
        elif divergence > 40:
            findings.append({
                "severity": "HIGH",
                "category": "Cash Flow Quality",
                "points": 12,
                "reason": (
                    f"Revenue-cashflow mismatch: revenue up {rev_growth:.0f}% "
                    f"vs cash flow up {cf_growth:.0f}%. "
                    "Profits may not be backed by real cash — accrual quality concern."
                ),
            })
        elif divergence > 20:
            findings.append({
                "severity": "MEDIUM",
                "category": "Cash Flow Quality",
                "points": 6,
                "reason": (
                    f"Moderate earnings-cash mismatch ({divergence:.0f}pp gap). "
                    "Monitor for widening divergence in future periods."
                ),
            })

    # Year-by-year: profit > cashflow check (classic red flag)
    latest_cf = cf[-1] if cf else None
    latest_rev = rev[-1] if rev else None
    if latest_cf is not None and latest_rev is not None and latest_rev > 0:
        cf_rev_ratio = latest_cf / latest_rev
        if cf_rev_ratio < 0.05:
            findings.append({
                "severity": "HIGH",
                "category": "Cash Flow Quality",
                "points": 10,
                "reason": (
                    f"Operating cash flow is only {cf_rev_ratio*100:.1f}% of revenue. "
                    "Extremely low cash conversion suggests poor earnings quality."
                ),
            })

    return findings


def _check_rising_debt_trend(debt: list, revenue: list) -> list:
    """Detects sustained multi-year debt increase (3+ consecutive years)."""
    findings = []
    d = _valid(debt)
    r = _valid(revenue)

    if len(d) < 2:
        return findings

    if _is_consistently_rising(d, min_years=3):
        findings.append({
            "severity": "HIGH",
            "category": "Debt & Leverage",
            "points": 14,
            "reason": (
                f"Debt has risen continuously for 3+ consecutive years. "
                "Persistent debt accumulation without matching revenue growth "
                "is a major solvency and fraud risk indicator."
            ),
        })
    elif _is_consistently_rising(d, min_years=2):
        findings.append({
            "severity": "MEDIUM",
            "category": "Debt & Leverage",
            "points": 7,
            "reason": "Debt has risen for 2 consecutive years — early warning of leveraging trend.",
        })

    # Debt-to-revenue ratio threshold check
    if d and r:
        latest_d = d[-1]
        latest_r = r[-1] if r else None
        if latest_r and latest_r > 0:
            ratio = latest_d / latest_r
            if ratio > 2.5:
                findings.append({
                    "severity": "CRITICAL",
                    "category": "Debt & Leverage",
                    "points": 16,
                    "reason": (
                        f"Debt-to-revenue ratio is {ratio:.1f}x — critically high. "
                        "The company owes more than 2.5x its annual revenue."
                    ),
                })
            elif ratio > 1.5:
                findings.append({
                    "severity": "HIGH",
                    "category": "Debt & Leverage",
                    "points": 10,
                    "reason": f"Debt-to-revenue ratio of {ratio:.1f}x exceeds safe thresholds.",
                })
            elif ratio > 0.8:
                findings.append({
                    "severity": "MEDIUM",
                    "category": "Debt & Leverage",
                    "points": 4,
                    "reason": f"Elevated debt of {ratio:.1f}x revenue. Worth monitoring.",
                })

    return findings


def _check_declining_profit_margin(profit: list, revenue: list) -> list:
    """
    Detects a sustained compression of net profit margin over time,
    which can indicate cost inflation, deteriorating pricing power, or manipulation.
    """
    findings = []
    p = _valid(profit)
    r = _valid(revenue)

    if len(p) < 2 or len(r) < 2:
        return findings

    n = min(len(p), len(r))
    p, r = p[-n:], r[-n:]

    # Compute per-year margins
    margins = []
    for pi, ri in zip(p, r):
        if ri and ri > 0:
            margins.append(pi / ri * 100)

    if len(margins) < 2:
        return findings

    margin_change = margins[-1] - margins[0]

    if margin_change < -15:
        findings.append({
            "severity": "HIGH",
            "category": "Profitability",
            "points": 13,
            "reason": (
                f"Profit margin collapsed by {abs(margin_change):.1f}pp "
                f"(from {margins[0]:.1f}% to {margins[-1]:.1f}%). "
                "Severe margin compression may indicate hidden cost issues or revenue manipulation."
            ),
        })
    elif margin_change < -8:
        findings.append({
            "severity": "MEDIUM",
            "category": "Profitability",
            "points": 7,
            "reason": (
                f"Profit margin declined {abs(margin_change):.1f}pp "
                f"({margins[0]:.1f}% → {margins[-1]:.1f}%)."
            ),
        })

    # Absolute margin too low
    latest_margin = margins[-1]
    if latest_margin < 0:
        findings.append({
            "severity": "CRITICAL",
            "category": "Profitability",
            "points": 15,
            "reason": f"Current net profit margin is negative ({latest_margin:.1f}%). Company is loss-making.",
        })
    elif latest_margin < 3:
        findings.append({
            "severity": "MEDIUM",
            "category": "Profitability",
            "points": 5,
            "reason": f"Very thin profit margin of {latest_margin:.1f}% leaves minimal buffer.",
        })

    # Check if consistently falling
    if _is_consistently_falling(margins, min_years=2):
        findings.append({
            "severity": "MEDIUM",
            "category": "Profitability",
            "points": 6,
            "reason": "Profit margin has declined year-over-year for 2+ consecutive years.",
        })

    return findings


def _check_negative_operating_cashflow(cashflow: list) -> list:
    """Flags sustained negative operating cash flows — a hard fraud signal."""
    findings = []
    cf = _valid(cashflow)

    neg_years = [c for c in cf if c < 0]
    neg_count = len(neg_years)

    if neg_count == 0:
        return findings

    if neg_count >= 3:
        findings.append({
            "severity": "CRITICAL",
            "category": "Cash Flow Quality",
            "points": 20,
            "reason": (
                f"Negative operating cash flow in {neg_count} out of {len(cf)} years. "
                "A company cannot sustain operations without positive cash generation — "
                "a critical fraud/insolvency flag."
            ),
        })
    elif neg_count == 2:
        findings.append({
            "severity": "HIGH",
            "category": "Cash Flow Quality",
            "points": 12,
            "reason": f"Negative operating cash flow in {neg_count} recent year(s).",
        })
    else:
        findings.append({
            "severity": "MEDIUM",
            "category": "Cash Flow Quality",
            "points": 6,
            "reason": "Negative operating cash flow detected in one recent year.",
        })

    # Declining cashflow trend
    if len(cf) >= 3 and _is_consistently_falling(cf, min_years=2):
        findings.append({
            "severity": "MEDIUM",
            "category": "Cash Flow Quality",
            "points": 6,
            "reason": "Operating cash flow has been declining for 2+ consecutive years.",
        })

    return findings


def _check_abnormal_growth_spikes(revenue: list) -> list:
    """
    Detects implausibly large single-year growth jumps (>50%) which may
    indicate channel stuffing, one-time booking, or reporting manipulation.
    """
    findings = []
    rev = _valid(revenue)

    if len(rev) < 2:
        return findings

    for i in range(1, len(rev)):
        change = _pct_change(rev[i - 1], rev[i])
        if change is None:
            continue
        if change > 100:
            findings.append({
                "severity": "HIGH",
                "category": "Revenue & Growth",
                "points": 10,
                "reason": (
                    f"Revenue spiked {change:.0f}% in a single year (year {i}→{i+1}). "
                    "Such extreme jumps are uncommon in legitimate operations and "
                    "warrant scrutiny for channel stuffing or revenue pull-forward."
                ),
            })
            break  # only flag the most extreme spike once
        elif change < -30:
            findings.append({
                "severity": "HIGH",
                "category": "Revenue & Growth",
                "points": 8,
                "reason": (
                    f"Revenue dropped {abs(change):.0f}% in one year — "
                    "a sudden collapse that signals operational distress or restatement risk."
                ),
            })
            break

    return findings


def _check_peer_deviation(
    revenue: list, profit: list, debt: list,
    peer_data: list[dict] | None
) -> list:
    """
    Compares key ratios of the company against sector peers.
    If the company is an extreme outlier, adds risk points.
    """
    findings = []
    if not peer_data or len(peer_data) < 2:
        return findings

    def _last(lst):
        v = _valid(lst)
        return v[-1] if v else None

    company_rev  = _last(revenue)
    company_prof = _last(profit)

    # Compute peer profit margins
    peer_margins = []
    for peer in peer_data:
        pr = _valid(peer.get("revenue", []))
        pp = _valid(peer.get("profit",  []))
        if pr and pp and pr[-1] and pr[-1] > 0:
            peer_margins.append(pp[-1] / pr[-1] * 100)

    if company_rev and company_prof and company_rev > 0 and peer_margins:
        company_margin = company_prof / company_rev * 100
        avg_peer_margin = sum(peer_margins) / len(peer_margins)
        gap = company_margin - avg_peer_margin

        if gap < -20:
            findings.append({
                "severity": "HIGH",
                "category": "Peer Deviation",
                "points": 10,
                "reason": (
                    f"Company profit margin ({company_margin:.1f}%) is "
                    f"{abs(gap):.1f}pp below sector peer average ({avg_peer_margin:.1f}%). "
                    "Significant underperformance relative to peers."
                ),
            })
        elif gap < -10:
            findings.append({
                "severity": "MEDIUM",
                "category": "Peer Deviation",
                "points": 5,
                "reason": (
                    f"Profit margin {gap:.1f}pp below sector peer average. "
                    "Moderate underperformance vs peers."
                ),
            })

    return findings


def _check_valuation_risk(pe: float | None, roe: float | None, beta: float | None) -> list:
    """Valuation and market-signal checks."""
    findings = []

    if pe is not None:
        if pe < 0:
            findings.append({
                "severity": "HIGH",
                "category": "Valuation",
                "points": 10,
                "reason": "Negative PE ratio — company is currently loss-making.",
            })
        elif pe > 120:
            findings.append({
                "severity": "HIGH",
                "category": "Valuation",
                "points": 8,
                "reason": (
                    f"Extremely high PE ratio ({pe:.0f}x) implies the market is "
                    "pricing in exceptional future growth — high reversal risk."
                ),
            })
        elif pe > 60:
            findings.append({
                "severity": "MEDIUM",
                "category": "Valuation",
                "points": 4,
                "reason": f"Elevated PE ratio of {pe:.0f}x — premium valuation.",
            })

    if roe is not None and roe < 0:
        findings.append({
            "severity": "HIGH",
            "category": "Valuation",
            "points": 8,
            "reason": "Negative return on equity — shareholders' capital is being eroded.",
        })

    if beta is not None and beta > 2.0:
        findings.append({
            "severity": "MEDIUM",
            "category": "Valuation",
            "points": 4,
            "reason": (
                f"High beta ({beta:.2f}) indicates the stock is highly volatile "
                "relative to the market — elevated systematic risk."
            ),
        })

    return findings


def _check_operational_red_flags(profit: list) -> list:
    """Additional checks: net losses, profit swings."""
    findings = []
    p = _valid(profit)

    if not p:
        return findings

    neg_count = sum(1 for v in p if v < 0)
    if neg_count >= 2:
        findings.append({
            "severity": "HIGH",
            "category": "Profitability",
            "points": 10,
            "reason": f"Net losses reported in {neg_count} year(s). Sustained losses burn shareholder capital.",
        })
    elif neg_count == 1:
        findings.append({
            "severity": "MEDIUM",
            "category": "Profitability",
            "points": 5,
            "reason": "Net loss reported in 1 year — could be one-off or beginning of a trend.",
        })

    # Wild profit swings (volatility)
    if len(p) >= 3:
        swings = [abs(_pct_change(p[i], p[i+1]) or 0) for i in range(len(p)-1)]
        avg_swing = sum(swings) / len(swings)
        if avg_swing > 60:
            findings.append({
                "severity": "MEDIUM",
                "category": "Profitability",
                "points": 5,
                "reason": (
                    f"Profit is highly volatile (avg year-over-year swing: {avg_swing:.0f}%). "
                    "Erratic earnings patterns can indicate accounting irregularities."
                ),
            })

    return findings


# ──────────────────────────────────────────────────────────────────────────────
# Master scoring function
# ──────────────────────────────────────────────────────────────────────────────

def compute_fraud_score(
    revenue: list,
    profit: list,
    debt: list,
    cashflow: list,
    pe: float | None = None,
    roe: float | None = None,
    beta: float | None = None,
    peer_data: list[dict] | None = None,
) -> dict:
    """
    Run all fraud checks and return a structured fraud score.

    Parameters
    ----------
    revenue   : annual revenue list (oldest → newest), values may be None
    profit    : annual net profit list
    debt      : annual total debt list
    cashflow  : annual operating cash flow list
    pe        : trailing PE ratio
    roe       : return on equity (decimal, e.g. 0.15 = 15%)
    beta      : stock beta
    peer_data : list of peer metric dicts with 'revenue' and 'profit' lists

    Returns
    -------
    dict with fraud_score, risk_level, risk_color, reasons, score_breakdown
    """

    all_findings: list[dict] = []

    # Run every check
    all_findings += _check_revenue_cashflow_mismatch(revenue, cashflow)
    all_findings += _check_rising_debt_trend(debt, revenue)
    all_findings += _check_declining_profit_margin(profit, revenue)
    all_findings += _check_negative_operating_cashflow(cashflow)
    all_findings += _check_abnormal_growth_spikes(revenue)
    all_findings += _check_peer_deviation(revenue, profit, debt, peer_data)
    all_findings += _check_valuation_risk(pe, roe, beta)
    all_findings += _check_operational_red_flags(profit)

    # Accumulate raw points
    raw_points = sum(f["points"] for f in all_findings)

    # Base score: start at 10 (healthy) and add points
    BASE = 10
    total = BASE + raw_points

    # Cap
    fraud_score = max(5, min(95, total))

    # Determine risk level
    risk_level, risk_color = "LOW", "#22c55e"
    for threshold, level, color in RISK_LEVEL_MAP:
        if fraud_score >= threshold:
            risk_level = level
            risk_color = color
            break

    # Sort findings by severity then points (most critical first)
    SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    all_findings.sort(key=lambda f: (SEVERITY_ORDER.get(f["severity"], 9), -f["points"]))

    # Score breakdown by category
    breakdown: dict[str, int] = {}
    for f in all_findings:
        cat = f["category"]
        breakdown[cat] = breakdown.get(cat, 0) + f["points"]

    # Build clean reason strings (for backward compat with red_flags)
    reason_strings = [f["reason"] for f in all_findings]

    return {
        "fraud_score":     fraud_score,
        "risk_level":      risk_level,
        "risk_color":      risk_color,
        "reasons":         all_findings,      # structured list with severity/category/points
        "reason_strings":  reason_strings,    # flat list for red_flags component
        "score_breakdown": breakdown,
    }
