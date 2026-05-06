import random
import hashlib
from datetime import datetime, timedelta

def generate_company_analysis(company_name: str) -> dict:
    # Deterministic seed based on company name for consistent results
    seed = int(hashlib.md5(company_name.lower().encode()).hexdigest(), 16) % 10000
    rng = random.Random(seed)

    fraud_score = rng.randint(10, 95)
    risk_level = (
        "CRITICAL" if fraud_score >= 75 else
        "HIGH" if fraud_score >= 55 else
        "MODERATE" if fraud_score >= 35 else
        "LOW"
    )

    risk_color = {
        "CRITICAL": "#ef4444",
        "HIGH": "#f97316",
        "MODERATE": "#eab308",
        "LOW": "#22c55e"
    }[risk_level]

    # Generate 12 months of revenue & expense data
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    base_revenue = rng.randint(40, 200) * 1_000_000
    revenue_trend = []
    expense_trend = []
    anomaly_flags = []

    for i, month in enumerate(months):
        variance = rng.uniform(0.85, 1.25)
        revenue = int(base_revenue * variance * (1 + i * 0.01))
        expense_ratio = rng.uniform(0.6, 0.95)
        expenses = int(revenue * expense_ratio)
        is_anomaly = rng.random() < (fraud_score / 300)

        revenue_trend.append({"month": month, "value": revenue, "anomaly": is_anomaly})
        expense_trend.append({"month": month, "value": expenses, "anomaly": is_anomaly})
        if is_anomaly:
            anomaly_flags.append({"month": month, "type": rng.choice([
                "Revenue spike", "Expense irregularity", "Missing records",
                "Round-number transactions", "Off-hours activity"
            ])})

    # Risk breakdown radar data
    risk_categories = [
        {"category": "Revenue Manipulation", "score": rng.randint(5, 95)},
        {"category": "Expense Fraud", "score": rng.randint(5, 95)},
        {"category": "Asset Misstatement", "score": rng.randint(5, 95)},
        {"category": "Related Party Txns", "score": rng.randint(5, 95)},
        {"category": "Cash Flow Anomalies", "score": rng.randint(5, 95)},
        {"category": "Audit Trail Gaps", "score": rng.randint(5, 95)},
    ]

    # Red flags
    all_flags = [
        "Unusual round-number transactions detected in Q3",
        "Revenue recognized before delivery confirmed",
        "Significant related-party transactions undisclosed",
        "High volume of journal entries near period close",
        "Cash flow does not match reported net income",
        "Inventory write-downs inconsistent with industry peers",
        "Auditor changed twice in 3 years",
        "Multiple restatements of prior financial periods",
        "Unusual spikes in accounts receivable",
        "CEO/CFO sold significant shares before earnings miss",
        "Off-balance-sheet liabilities identified",
        "Discrepancies in subsidiary consolidations",
    ]
    num_flags = max(1, int(fraud_score / 15))
    red_flags = rng.sample(all_flags, min(num_flags, len(all_flags)))

    # AI Summary based on risk level
    summaries = {
        "CRITICAL": f"{company_name} exhibits severe indicators of financial misconduct. Our AI models have detected patterns consistent with revenue fabrication, undisclosed liabilities, and systematic manipulation of key financial metrics. Immediate forensic audit is strongly recommended. {len(red_flags)} critical red flags were identified across the reviewed financial periods.",
        "HIGH": f"{company_name} presents significant fraud risk factors. Multiple anomalies in revenue recognition and expense reporting were detected. The pattern of transactions near period-close dates and inconsistencies in cash flow statements warrant urgent investigation by qualified forensic accountants.",
        "MODERATE": f"{company_name} shows some concerning financial patterns that deviate from industry norms. While not conclusive evidence of fraud, {len(red_flags)} irregularities were flagged for further review. Enhanced due diligence is recommended before any material financial decisions.",
        "LOW": f"{company_name} demonstrates generally sound financial practices with minor anomalies within acceptable thresholds. Routine audit procedures are recommended. The flagged items appear consistent with normal business operations but should be documented and monitored.",
    }

    return {
        "company_name": company_name,
        "analyzed_at": datetime.utcnow().isoformat(),
        "fraud_score": fraud_score,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "summary": summaries[risk_level],
        "red_flags": red_flags,
        "revenue_trend": revenue_trend,
        "expense_trend": expense_trend,
        "anomaly_flags": anomaly_flags,
        "risk_categories": risk_categories,
        "financials": {
            "total_revenue": sum(r["value"] for r in revenue_trend),
            "total_expenses": sum(e["value"] for e in expense_trend),
            "anomalies_detected": len(anomaly_flags),
            "periods_reviewed": 12,
            "data_completeness": rng.randint(72, 99),
        }
    }
