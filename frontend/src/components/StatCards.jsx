import { formatCurrency } from '../utils/format'

function Trend({ value }) {
  if (value == null) return null
  const positive = value >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      color: positive ? '#22c55e' : '#ef4444',
      fontFamily: 'JetBrains Mono', fontSize: '0.62rem', fontWeight: 600,
    }}>
      {positive ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  )
}

function latestByYear(values = [], years = []) {
  let latest = null
  let latestYear = -Infinity
  values.forEach((value, index) => {
    if (value == null) return
    const year = Number(years[index])
    if (Number.isFinite(year) && year >= latestYear) {
      latest = value
      latestYear = year
    }
  })
  return latest
}

export default function StatCards({ data }) {
  const { financials, company_info } = data
  const avgRisk = data.risk_categories
    ? Math.round(data.risk_categories.reduce((a, c) => a + c.score, 0) / data.risk_categories.length)
    : 0

  // Compute revenue growth % YoY
  const rev = data.revenue_10y?.filter(v => v != null) || []
  const latestRevenue = financials?.total_revenue || latestByYear(data.revenue_10y, data.years)
  const revGrowth = rev.length >= 2
    ? +((rev[rev.length - 1] - rev[rev.length - 2]) / Math.abs(rev[rev.length - 2]) * 100).toFixed(1)
    : null

  const prf = data.profit_10y?.filter(v => v != null) || []
  const prfGrowth = prf.length >= 2
    ? +((prf[prf.length - 1] - prf[prf.length - 2]) / Math.abs(prf[prf.length - 2]) * 100).toFixed(1)
    : null

  const stats = [
    {
      label: 'Market Cap',
      value: company_info?.market_cap ? formatCurrency(company_info.market_cap) : 'N/A',
      sub: company_info?.sector || 'N/A',
      trend: null,
      icon: '📈', accent: '#22c55e',
    },
    {
      label: 'PE Ratio',
      value: company_info?.pe_ratio != null ? company_info.pe_ratio.toFixed(1) : 'N/A',
      sub: company_info?.forward_pe != null ? `Fwd: ${company_info.forward_pe.toFixed(1)}` : 'Forward PE: N/A',
      trend: null,
      icon: '⏱', accent: '#6366F1',
    },
    {
      label: 'Revenue (Latest)',
      value: formatCurrency(latestRevenue),
      sub: `${financials?.periods_reviewed || 0}Y data`,
      trend: revGrowth,
      icon: '💹', accent: '#22c55e',
    },
    {
      label: 'Profit Margin',
      value: company_info?.profit_margin != null ? `${company_info.profit_margin.toFixed(1)}%` : 'N/A',
      sub: company_info?.roe != null ? `ROE: ${company_info.roe.toFixed(1)}%` : 'ROE: N/A',
      trend: prfGrowth,
      icon: '📊', accent: '#f97316',
    },
    {
      label: 'Risk Score',
      value: `${avgRisk}/100`,
      sub: `across ${data.risk_categories?.length || 0} dimensions`,
      trend: null,
      icon: '🎯', accent: '#eab308',
    },
    {
      label: 'Red Flags',
      value: data.red_flags?.length || 0,
      sub: 'risk indicators',
      trend: null,
      icon: '🚩', accent: '#ef4444',
    },
  ]

  return (
    /* `stat-grid` is owned by index.css and adapts: 3 cols desktop, 2 tablet, 1–2 mobile */
    <div className="stat-grid stat-grid-fill">
      {stats.map((s, i) => (
        <div key={i} className="card stat-card" style={{
          padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 8,
          position: 'relative', overflow: 'hidden',
          transition: 'transform 0.18s, border-color 0.18s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `${s.accent}35` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          {/* Background glow dot */}
          <div style={{
            position: 'absolute', bottom: -20, right: -20,
            width: 80, height: 80, borderRadius: '50%',
            background: `${s.accent}08`, pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{
              color: 'var(--text-muted)', fontSize: '0.65rem',
              fontFamily: 'JetBrains Mono', fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>{s.label}</span>
            <span style={{
              width: 28, height: 28, borderRadius: 7,
              background: `${s.accent}14`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.82rem', flexShrink: 0,
            }}>{s.icon}</span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.35rem', color: s.accent, lineHeight: 1 }}>
                {s.value}
              </span>
              {s.trend != null && <Trend value={s.trend} />}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', margin: '3px 0 0', fontFamily: 'JetBrains Mono' }}>
              {s.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
