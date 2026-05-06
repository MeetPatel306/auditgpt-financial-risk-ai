/**
 * AuditGPT PDF Report Generator
 * Uses jsPDF (loaded via CDN script to bypass Vite bundler constraints) + html2canvas.
 */

import html2canvas from 'html2canvas'

/**
 * Load jsPDF from CDN if not already on window.
 * Returns the jsPDF constructor.
 */
async function getJsPDF() {
  // Prefer bundled dependency to avoid runtime CDN/network failures.
  try {
    const mod = await import('jspdf')
    if (mod?.jsPDF) return mod.jsPDF
  } catch {
    // Fall back to CDN loader below.Remove-Item -Recurse -Force venv
  }

  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF

  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script.onload  = resolve
    script.onerror = () => reject(new Error('Failed to load jsPDF from CDN'))
    document.head.appendChild(script)
  })

  return window.jspdf.jsPDF
}

async function savePdfDirect(pdf, filename) {
  // Native jsPDF save path (uses FileSaver internally) — avoids opening tabs.
  try {
    await pdf.save(filename, { returnPromise: true })
    return true
  } catch (saveErr) {
    console.warn('pdf.save failed:', saveErr)
  }

  // Legacy Windows fallback.
  try {
    if (window.navigator?.msSaveOrOpenBlob) {
      const blob = pdf.output('blob')
      window.navigator.msSaveOrOpenBlob(blob, filename)
      return true
    }
  } catch (msErr) {
    console.warn('msSaveOrOpenBlob failed:', msErr)
  }

  return false
}


/* ── Helpers ──────────────────────────────────────────────────────────── */
function fmt(value) {
  if (value == null || isNaN(value)) return 'N/A'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}₹${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `${sign}₹${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e7)  return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5)  return `${sign}₹${(abs / 1e5).toFixed(2)}L`
  return `${sign}₹${Math.round(abs)}`
}

function riskColor(level) {
  return { CRITICAL: '#dc2626', HIGH: '#ea580c', MODERATE: '#ca8a04', LOW: '#16a34a' }[level] || '#ca8a04'
}

function sentimentColor(s) {
  return { positive: '#16a34a', neutral: '#0284c7', negative: '#dc2626' }[s] || '#6b7280'
}

function pct(a, b) {
  if (!a || !b || a === 0) return null
  return ((b - a) / Math.abs(a) * 100).toFixed(1)
}

/* ── Mini bar chart as SVG ────────────────────────────────────────────── */
function miniBarChart(values, years, color = '#0ea5e9', height = 60) {
  if (!values?.length) return ''
  const valid = values.map(v => v ?? 0)
  const maxVal = Math.max(...valid.map(Math.abs), 1)
  const w = 40
  const gap = 6
  const totalW = valid.length * (w + gap)

  const bars = valid.map((v, i) => {
    const barH = Math.abs(v) / maxVal * (height - 16)
    const y = v >= 0 ? height - barH - 12 : height / 2
    const barColor = v >= 0 ? color : '#dc2626'
    const yr = years?.[i] || (2015 + i)
    return `
      <rect x="${i * (w + gap)}" y="${y}" width="${w}" height="${barH}" fill="${barColor}" rx="2" opacity="0.85"/>
      <text x="${i * (w + gap) + w / 2}" y="${height - 2}" text-anchor="middle" font-size="7" fill="#6b7280">${yr}</text>
    `
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" style="max-width:100%">${bars}</svg>`
}

/* ── Sentiment sparkline as SVG ────────────────────────────────────────── */
function sentimentSparkline(yearly) {
  if (!yearly?.length) return ''
  const W = 400, H = 60, pad = 20
  const scores = yearly.map(y => y.chart_score ?? 50)
  const maxS = 100, minS = 0
  const pts = scores.map((s, i) => {
    const x = pad + (i / Math.max(scores.length - 1, 1)) * (W - pad * 2)
    const y = H - pad - ((s - minS) / (maxS - minS)) * (H - pad * 2)
    return `${x},${y}`
  }).join(' ')

  const dots = scores.map((s, i) => {
    const x = pad + (i / Math.max(scores.length - 1, 1)) * (W - pad * 2)
    const y = H - pad - ((s - minS) / (maxS - minS)) * (H - pad * 2)
    const yr = yearly[i]
    const c = sentimentColor(yr.sentiment)
    return `<circle cx="${x}" cy="${y}" r="4" fill="${c}" stroke="white" stroke-width="1.5"/>`
  }).join('')

  const yearLabels = yearly.map((y, i) => {
    const x = pad + (i / Math.max(scores.length - 1, 1)) * (W - pad * 2)
    return `<text x="${x}" y="${H - 2}" text-anchor="middle" font-size="7" fill="#6b7280">FY${y.year}</text>`
  }).join('')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="max-width:100%">
      <line x1="${pad}" y1="${H/2-6}" x2="${W-pad}" y2="${H/2-6}" stroke="#d1d5db" stroke-dasharray="3,3" stroke-width="1"/>
      <polyline points="${pts}" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
      ${yearLabels}
    </svg>
  `
}

/* ── Build HTML report template ────────────────────────────────────────── */
function buildReportHTML(data) {
  const {
    company_name, nse_symbol, fraud_score, risk_level, analyzed_at,
    years, revenue_10y, profit_10y, debt_10y, cashflow_10y,
    company_info, fraud_details, auditor_sentiment, comparison,
    red_flags, summary,
  } = data

  const rColor = riskColor(risk_level)
  const info = company_info || {}
  const reasons = fraud_details?.reasons || []
  const breakdown = fraud_details?.score_breakdown || {}
  const yearly = auditor_sentiment?.yearly || []
  const peers = comparison?.peers || []
  const inputCo = comparison?.input_company || {}
  const summaryText = typeof summary === 'string'
    ? summary
    : summary == null
      ? ''
      : Array.isArray(summary)
        ? summary.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n\n')
        : JSON.stringify(summary)

  // Revenue change
  const validRev = (revenue_10y || []).filter(v => v != null)
  const revChange = validRev.length >= 2 ? pct(validRev[0], validRev[validRev.length - 1]) : null
  const validPrf = (profit_10y || []).filter(v => v != null)
  const prfChange = validPrf.length >= 2 ? pct(validPrf[0], validPrf[validPrf.length - 1]) : null

  // Date
  const dateStr = analyzed_at ? new Date(analyzed_at).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) : new Date().toLocaleDateString('en-IN')

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #ffffff;
    color: #1e293b;
    font-size: 13px;
    line-height: 1.6;
    width: 794px;
    padding: 0;
  }

  /* ── Page sections ── */
  .page { width: 794px; min-height: 1123px; padding: 40px 48px; position: relative; page-break-after: always; }
  .page-2 { width: 794px; padding: 40px 48px; }

  /* ── Header ── */
  .report-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;
  }
  .brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px }
  .brand span { color: #0ea5e9 }
  .brand-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px }
  .report-meta { text-align: right }
  .report-meta .date { font-size: 11px; color: #64748b }
  .report-meta .confidential {
    background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;
    font-size: 9px; padding: 2px 8px; border-radius: 4px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; display: inline-block;
  }

  /* ── Company hero ── */
  .company-hero {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 12px; padding: 24px 28px; margin-bottom: 20px;
    color: white; display: flex; justify-content: space-between; align-items: center;
  }
  .company-name { font-size: 20px; font-weight: 700; margin-bottom: 4px }
  .company-sub { font-size: 11px; color: #94a3b8 }
  .score-ring {
    text-align: center;
    background: rgba(255,255,255,0.08); border-radius: 10px;
    padding: 16px 20px; border: 1px solid rgba(255,255,255,0.12);
    min-width: 120px;
  }
  .score-num { font-size: 36px; font-weight: 800; line-height: 1 }
  .score-label { font-size: 9px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px }
  .risk-badge-pdf {
    display: inline-block; margin-top: 8px;
    border-radius: 6px; padding: 4px 12px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
  }

  /* ── Section headings ── */
  .section { margin-bottom: 22px }
  .section-title {
    font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
    color: #64748b; border-left: 3px solid #0ea5e9; padding-left: 8px; margin-bottom: 12px;
  }

  /* ── KPI grid ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px }
  .kpi-card {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 12px 14px;
  }
  .kpi-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px }
  .kpi-value { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 3px }
  .kpi-sub { font-size: 9px; color: #64748b; margin-top: 1px }

  /* ── Chart section ── */
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px }
  .chart-card {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;
    overflow: hidden;
  }
  .chart-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px }

  /* ── Findings table ── */
  .findings-table { width: 100%; border-collapse: collapse; font-size: 11px }
  .findings-table th {
    background: #f1f5f9; text-align: left; padding: 8px 10px;
    font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;
    border-bottom: 1px solid #e2e8f0;
  }
  .findings-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top }
  .findings-table tr:last-child td { border-bottom: none }
  .sev-badge {
    display: inline-block; border-radius: 4px; padding: 1px 7px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.3px;
  }

  /* ── Peer table ── */
  .peer-table { width: 100%; border-collapse: collapse; font-size: 11px }
  .peer-table th {
    background: #f1f5f9; text-align: left; padding: 7px 10px;
    font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;
    border-bottom: 1px solid #e2e8f0;
  }
  .peer-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px }
  .peer-table tr.input-row td { background: #eff6ff; font-weight: 600 }

  /* ── AI Summary box ── */
  .summary-box {
    background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;
    padding: 16px 18px; border-left: 4px solid #0ea5e9;
  }
  .summary-text { color: #1e293b; font-size: 12px; line-height: 1.7 }
  .summary-para { margin-bottom: 10px }
  .summary-para:last-child { margin-bottom: 0 }

  /* ── Sentiment ── */
  .sentiment-row {
    display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;
  }
  .sent-pill {
    border-radius: 5px; padding: 4px 10px; font-size: 10px; font-weight: 600;
  }

  /* ── Footer ── */
  .report-footer {
    position: absolute; bottom: 20px; left: 48px; right: 48px;
    border-top: 1px solid #e2e8f0; padding-top: 10px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-text { font-size: 9px; color: #94a3b8 }

  /* ── Disclaimer ── */
  .disclaimer {
    background: #fefce8; border: 1px solid #fde68a; border-radius: 6px;
    padding: 10px 14px; margin-top: 20px; font-size: 10px; color: #78350f;
    line-height: 1.5;
  }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════ PAGE 1 ══════════ -->
<div class="page">

  <!-- Header -->
  <div class="report-header">
    <div>
      <div class="brand">Audit<span>GPT</span></div>
      <div class="brand-sub">AI-Powered Financial Fraud Detection</div>
    </div>
    <div class="report-meta">
      <div class="date">Report Date: ${dateStr}</div>
      <div class="date" style="margin-top:3px">Reference ID: AGT-${Date.now().toString(36).toUpperCase()}</div>
      <span class="confidential">Confidential</span>
    </div>
  </div>

  <!-- Company Hero -->
  <div class="company-hero">
    <div>
      <div class="company-name">${company_name}</div>
      <div class="company-sub">NSE: ${nse_symbol || 'N/A'} &nbsp;|&nbsp; ${info.sector || 'N/A'} &nbsp;|&nbsp; ${info.industry || 'N/A'}</div>
      <div style="margin-top:12px; display:flex; gap:16px;">
        ${info.market_cap ? `<div><div style="font-size:9px;color:#94a3b8;text-transform:uppercase">Market Cap</div><div style="font-size:13px;font-weight:600">${fmt(info.market_cap)}</div></div>` : ''}
        ${info.current_price ? `<div><div style="font-size:9px;color:#94a3b8;text-transform:uppercase">Price (₹)</div><div style="font-size:13px;font-weight:600">₹${info.current_price}</div></div>` : ''}
        ${info.pe_ratio ? `<div><div style="font-size:9px;color:#94a3b8;text-transform:uppercase">PE Ratio</div><div style="font-size:13px;font-weight:600">${info.pe_ratio}x</div></div>` : ''}
        ${info.beta ? `<div><div style="font-size:9px;color:#94a3b8;text-transform:uppercase">Beta</div><div style="font-size:13px;font-weight:600">${info.beta}</div></div>` : ''}
      </div>
    </div>
    <div class="score-ring">
      <div class="score-num" style="color:${rColor}">${fraud_score}</div>
      <div class="score-label">Fraud Score</div>
      <div class="risk-badge-pdf" style="background:${rColor}22;color:${rColor};border:1px solid ${rColor}55">
        ${risk_level} RISK
      </div>
    </div>
  </div>

  <!-- KPI Summary -->
  <div class="section">
    <div class="section-title">Executive Summary — Key Metrics</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Latest Revenue</div>
        <div class="kpi-value">${fmt(validRev[validRev.length - 1])}</div>
        ${revChange !== null ? `<div class="kpi-sub" style="color:${parseFloat(revChange) >= 0 ? '#16a34a' : '#dc2626'}">${parseFloat(revChange) >= 0 ? '▲' : '▼'} ${Math.abs(revChange)}% vs ${years?.[0] || ''}</div>` : ''}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Latest Net Profit</div>
        <div class="kpi-value">${fmt(validPrf[validPrf.length - 1])}</div>
        ${prfChange !== null ? `<div class="kpi-sub" style="color:${parseFloat(prfChange) >= 0 ? '#16a34a' : '#dc2626'}">${parseFloat(prfChange) >= 0 ? '▲' : '▼'} ${Math.abs(prfChange)}% change</div>` : ''}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Profit Margin</div>
        <div class="kpi-value">${info.profit_margin != null ? info.profit_margin + '%' : 'N/A'}</div>
        <div class="kpi-sub">Net margin latest year</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Return on Equity</div>
        <div class="kpi-value">${info.roe != null ? info.roe + '%' : 'N/A'}</div>
        <div class="kpi-sub">Shareholder return</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Debt (Latest)</div>
        <div class="kpi-value">${fmt((debt_10y || []).filter(v => v != null).pop())}</div>
        <div class="kpi-sub">From balance sheet</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Operating Cash Flow</div>
        <div class="kpi-value">${fmt((cashflow_10y || []).filter(v => v != null).pop())}</div>
        <div class="kpi-sub">Latest year OCF</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">52-Week High</div>
        <div class="kpi-value">${info.fifty_two_week_high != null ? '₹' + info.fifty_two_week_high : 'N/A'}</div>
        <div class="kpi-sub">NSE market data</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Dividend Yield</div>
        <div class="kpi-value">${info.dividend_yield != null ? info.dividend_yield + '%' : 'N/A'}</div>
        <div class="kpi-sub">Annual yield</div>
      </div>
    </div>
  </div>

  <!-- Revenue & Profit Charts (SVG) -->
  <div class="section">
    <div class="section-title">Financial Trend (${years?.[0] || ''}–${years?.[years?.length-1] || ''})</div>
    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-label">Revenue (Annual)</div>
        ${miniBarChart(revenue_10y, years, '#0ea5e9')}
      </div>
      <div class="chart-card">
        <div class="chart-label">Net Profit (Annual)</div>
        ${miniBarChart(profit_10y, years, '#10b981')}
      </div>
      <div class="chart-card">
        <div class="chart-label">Total Debt (Annual)</div>
        ${miniBarChart(debt_10y, years, '#f97316')}
      </div>
      <div class="chart-card">
        <div class="chart-label">Operating Cash Flow (Annual)</div>
        ${miniBarChart(cashflow_10y, years, '#8b5cf6')}
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <span class="footer-text">AuditGPT — AI Financial Intelligence &nbsp;|&nbsp; auditgpt.ai</span>
    <span class="footer-text">Page 1 of 2 &nbsp;|&nbsp; ${dateStr}</span>
  </div>

</div>

<!-- ═══════════════════════════════════════════════ PAGE 2 ══════════ -->
<div class="page-2">

  <!-- Header repeat -->
  <div class="report-header">
    <div>
      <div class="brand">Audit<span>GPT</span></div>
      <div class="brand-sub">Financial Risk Report — ${company_name}</div>
    </div>
    <div class="report-meta">
      <div class="date">${dateStr}</div>
      <span class="confidential">Page 2</span>
    </div>
  </div>

  <!-- Fraud Findings -->
  ${reasons.length > 0 ? `
  <div class="section">
    <div class="section-title">Fraud Detection Findings (${reasons.length} signals, Score: ${fraud_score}/100)</div>
    <table class="findings-table">
      <thead>
        <tr>
          <th style="width:70px">Severity</th>
          <th style="width:120px">Category</th>
          <th style="width:50px">Points</th>
          <th>Finding</th>
        </tr>
      </thead>
      <tbody>
        ${reasons.slice(0, 8).map(r => {
          const sevColors = {
            CRITICAL: { bg: '#fee2e2', color: '#dc2626' },
            HIGH:     { bg: '#ffedd5', color: '#ea580c' },
            MEDIUM:   { bg: '#fefce8', color: '#ca8a04' },
            LOW:      { bg: '#dcfce7', color: '#16a34a' },
          }
          const sc = sevColors[r.severity] || sevColors.MEDIUM
          return `
          <tr>
            <td><span class="sev-badge" style="background:${sc.bg};color:${sc.color}">${r.severity}</span></td>
            <td style="color:#64748b;font-size:10px">${r.category}</td>
            <td style="color:${sc.color};font-weight:600">+${r.points}</td>
            <td style="color:#374151;font-size:11px">${r.reason}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Peer Comparison -->
  ${comparison?.all_companies?.length > 0 ? `
  <div class="section">
    <div class="section-title">Peer Comparison — Sector Analysis</div>
    <table class="peer-table">
      <thead>
        <tr>
          <th>Company</th>
          <th>Rev. Growth</th>
          <th>Profit Growth</th>
          <th>Debt Ratio</th>
          <th>Market Cap</th>
          <th>PE</th>
          <th>Margin</th>
          <th>Risk Score</th>
        </tr>
      </thead>
      <tbody>
        ${(comparison.all_companies || []).slice(0, 6).map(c => `
        <tr class="${c.is_input ? 'input-row' : ''}">
          <td>${c.symbol}${c.is_input ? ' ★' : ''}</td>
          <td style="color:${(c.revenue_growth ?? 0) >= 0 ? '#16a34a' : '#dc2626'}">${c.revenue_growth != null ? (c.revenue_growth > 0 ? '+' : '') + c.revenue_growth + '%' : '—'}</td>
          <td style="color:${(c.profit_growth ?? 0) >= 0 ? '#16a34a' : '#dc2626'}">${c.profit_growth != null ? (c.profit_growth > 0 ? '+' : '') + c.profit_growth + '%' : '—'}</td>
          <td>${c.debt_ratio != null ? c.debt_ratio + 'x' : '—'}</td>
          <td>${c.market_cap != null ? fmt(c.market_cap) : '—'}</td>
          <td>${c.pe_ratio != null ? c.pe_ratio + 'x' : '—'}</td>
          <td>${c.profit_margin != null ? c.profit_margin + '%' : '—'}</td>
          <td style="font-weight:600;color:${riskColor(c.risk_level || 'MODERATE')}">${c.risk_score ?? '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Auditor Sentiment -->
  ${yearly.length > 0 ? `
  <div class="section">
    <div class="section-title">Auditor Sentiment Analysis — NLP</div>
    <div style="margin-bottom:8px">
      <span style="font-size:10px;color:#64748b">Overall: </span>
      <span style="font-weight:600;color:${sentimentColor(auditor_sentiment.overall_sentiment)}">${auditor_sentiment.overall_sentiment?.toUpperCase()}</span>
      &nbsp;&nbsp;
      <span style="font-size:10px;color:#64748b">Trend: </span>
      <span style="font-weight:600;color:#0ea5e9">${auditor_sentiment.trend}</span>
      ${auditor_sentiment.risk_flag ? `&nbsp;&nbsp;<span style="background:#fee2e2;color:#dc2626;border-radius:4px;padding:1px 8px;font-size:9px;font-weight:700">⚑ RISK FLAGGED</span>` : ''}
    </div>
    ${sentimentSparkline(yearly)}
    <div class="sentiment-row" style="margin-top:10px">
      ${yearly.map(y => `
        <div class="sent-pill" style="background:${sentimentColor(y.sentiment)}18;color:${sentimentColor(y.sentiment)};border:1px solid ${sentimentColor(y.sentiment)}30">
          FY${y.year}: ${y.label} (${y.chart_score}/100)
        </div>
      `).join('')}
    </div>
    ${auditor_sentiment.risk_reason ? `<div style="font-size:10px;color:#dc2626;margin-top:8px;padding:8px;background:#fee2e2;border-radius:5px">⚑ ${auditor_sentiment.risk_reason}</div>` : ''}
  </div>` : ''}

  <!-- AI Summary -->
  ${summaryText ? `
  <div class="section">
    <div class="section-title">AI-Generated Analysis Summary</div>
    <div class="summary-box">
      ${summaryText.split('\n\n').map(p => `<p class="summary-para summary-text">${p.trim()}</p>`).join('')}
    </div>
  </div>` : ''}

  <!-- Disclaimer -->
  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report is generated by AuditGPT using publicly available financial data from NSE/Yahoo Finance.
    It is intended for informational purposes only and does not constitute financial, investment, or legal advice.
    All scores and risk assessments are algorithmic in nature. Please conduct independent due diligence before making any financial decisions.
    Data accuracy is subject to availability and timeliness of third-party financial data providers.
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #e2e8f0;margin-top:20px;padding-top:10px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:9px;color:#94a3b8">AuditGPT — AI Financial Intelligence &nbsp;|&nbsp; Generated ${dateStr}</span>
    <span style="font-size:9px;color:#94a3b8">Page 2 of 2 &nbsp;|&nbsp; CONFIDENTIAL</span>
  </div>

</div>

</body>
</html>
`
}

/* ── Main export ──────────────────────────────────────────────────────── */
/**
 * Generate and download a PDF report for the given analysis data.
 * @param {object} data  – full analysis payload from /analyze-company
 * @param {function} [onProgress]  – optional callback(0-100) for progress
 */
export async function downloadPDFReport(data, onProgress) {
  const progress = onProgress || (() => {})

  progress(5)

  // 1. Build HTML
  const html = buildReportHTML(data)
  progress(10)

  // 2. Inject into off-screen container
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 794px;
    background: #ffffff;
    z-index: -1;
  `
  container.innerHTML = html
  document.body.appendChild(container)

  progress(20)

  // Wait a tick for fonts/images to settle
  await new Promise(r => setTimeout(r, 300))

  try {
    progress(30)

    const JsPDF = await getJsPDF()
    const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    try {
      // 3. Capture with html2canvas (high resolution)
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
      })

      progress(75)

      const A4_W = 210
      const A4_H = 297
      const canvasPxW = canvas.width
      const canvasPxH = canvas.height
      const mmPerPx = A4_W / canvasPxW
      const pageHeightPx = A4_H / mmPerPx

      let offsetY = 0
      let pageNum = 0

      while (offsetY < canvasPxH) {
        if (pageNum > 0) pdf.addPage()

        const sliceH = Math.min(pageHeightPx, canvasPxH - offsetY)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvasPxW
        pageCanvas.height = Math.ceil(sliceH)

        const ctx = pageCanvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvasPxW, Math.ceil(sliceH))
        ctx.drawImage(canvas, 0, -offsetY)

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.96)
        const sliceHeightMM = sliceH * mmPerPx
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W, sliceHeightMM)

        offsetY += sliceH
        pageNum++
        progress(75 + (offsetY / canvasPxH) * 20)
      }
    } catch (renderErr) {
      // Fallback path: always provide a downloadable report.
      console.warn('PDF render fallback used:', renderErr)
      progress(75)

      const lines = [
        `AuditGPT Financial Risk Report`,
        ``,
        `Company: ${data.company_name || 'N/A'} (${data.nse_symbol || 'N/A'})`,
        `Fraud Score: ${data.fraud_score ?? 'N/A'} / 100`,
        `Risk Level: ${data.risk_level || 'N/A'}`,
        `Generated: ${new Date().toLocaleString()}`,
        ``,
        `AI Summary:`,
        ...(data.summary ? String(data.summary).split('\n').flatMap((s) => [s, '']) : ['N/A']),
      ]

      let y = 16
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      for (const line of lines) {
        if (y > 280) {
          pdf.addPage()
          y = 16
        }
        const wrapped = pdf.splitTextToSize(line || ' ', 180)
        for (const w of wrapped) {
          if (y > 280) {
            pdf.addPage()
            y = 16
          }
          pdf.text(w, 15, y)
          y += 6
        }
      }
    }

    progress(97)

    // 5. Download
    const safeName = (data.nse_symbol || data.company_name || 'Report').replace(/\s+/g, '_')
    const filename = `AuditGPT_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`
    const saved = await savePdfDirect(pdf, filename)
    if (!saved) throw new Error('Unable to start file download. Check Chrome download settings for this site.')

    progress(100)
  } finally {
    if (container?.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
}
