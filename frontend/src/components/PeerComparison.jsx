import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { formatCurrency } from '../utils/format'

/* ─── Colour Palette ────────────────────────────────────────────────── */
const INPUT_COLOR  = '#6366F1'
const PEER_COLORS  = ['#a855f7', '#f97316', '#22c55e', '#eab308', '#ec4899']
const RISK_COLORS  = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#eab308', LOW: '#22c55e' }

function companyColor(c, allCompanies) {
  if (c.is_input) return INPUT_COLOR
  const peerIdx = allCompanies.filter(x => !x.is_input).findIndex(p => p.symbol === c.symbol)
  return PEER_COLORS[peerIdx % PEER_COLORS.length]
}

/* ─── Tooltip ───────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0d1420', border: '1px solid #1e2d42', borderRadius: '8px',
      padding: '10px 14px', fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill, margin: '2px 0' }}>
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

/* ─── Section label ─────────────────────────────────────────────────── */
function ChartLabel({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <h4 style={{
        fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.72rem',
        letterSpacing: '0.12em', color: 'var(--text-muted)',
        textTransform: 'uppercase', margin: 0,
      }}>{title}</h4>
      {subtitle && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono', margin: '3px 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

/* ─── Tag badge ─────────────────────────────────────────────────────── */
function Tag({ label, color }) {
  return (
    <span style={{
      fontSize: '0.56rem', fontFamily: 'JetBrains Mono', padding: '1px 5px',
      borderRadius: '3px', background: `${color}18`, color,
      border: `1px solid ${color}30`, marginLeft: '5px', fontWeight: 600,
    }}>{label}</span>
  )
}

/* ─── Main Component ────────────────────────────────────────────────── */
export default function PeerComparison({ comparison }) {
  const [activeChart, setActiveChart] = useState('revenue')

  if (!comparison?.all_companies?.length) return null

  const { all_companies, highlights, input_company, peers } = comparison

  /* colour mapping keyed by symbol for consistency */
  const colorMap = {}
  all_companies.forEach((c) => { colorMap[c.symbol] = companyColor(c, all_companies) })

  /* ── Chart builders ── */
  function makeChartData(valueKey) {
    return all_companies
      .filter(c => c[valueKey] != null)
      .map(c => ({
        name: c.symbol,
        value: c[valueKey],
        isInput: c.is_input,
        fill: colorMap[c.symbol],
      }))
  }

  const CHARTS = {
    revenue: {
      label: 'Revenue',
      subtitle: 'Latest annual revenue (₹)',
      data: makeChartData('latest_revenue'),
      fmt: v => formatCurrency(v),
    },
    profit: {
      label: 'Net Profit',
      subtitle: 'Latest annual net profit (₹)',
      data: makeChartData('latest_profit'),
      fmt: v => formatCurrency(v),
    },
    debt: {
      label: 'Debt Ratio',
      subtitle: 'Debt-to-Revenue ratio (lower = healthier)',
      data: makeChartData('debt_ratio'),
      fmt: v => `${v}x`,
    },
  }

  const chart = CHARTS[activeChart]

  /* ── Rankings ── */
  const rankings = [
    {
      icon: '🏆',
      label: 'Best Revenue Growth',
      symbol: highlights?.best_revenue_growth,
      color: '#22c55e',
      sub: 'Highest revenue growth %',
    },
    {
      icon: '💰',
      label: 'Most Profitable',
      symbol: highlights?.best_profit_margin,
      color: '#6366F1',
      sub: 'Highest profit margin',
    },
    {
      icon: '⚠',
      label: 'Highest Risk',
      symbol: highlights?.highest_risk,
      color: '#ef4444',
      sub: 'Highest risk score',
    },
    {
      icon: '🛡',
      label: 'Safest Company',
      symbol: highlights?.lowest_risk,
      color: '#22c55e',
      sub: 'Lowest risk score',
    },
    {
      icon: '📈',
      label: 'Largest Market Cap',
      symbol: highlights?.highest_market_cap,
      color: '#a855f7',
      sub: 'Biggest by market cap',
    },
    {
      icon: '⚡',
      label: 'Best Profit Growth',
      symbol: highlights?.best_profit_growth,
      color: '#eab308',
      sub: 'Highest profit growth %',
    },
  ]

  function findCompany(sym) {
    return all_companies.find(c => c.symbol === sym)
  }

  /* ── Color helpers ── */
  function growthColor(v) {
    if (v == null) return 'var(--text-muted)'
    if (v > 20) return '#22c55e'
    if (v > 0) return '#86efac'
    if (v > -20) return '#fbbf24'
    return '#ef4444'
  }
  function debtColor(v) {
    if (v == null) return 'var(--text-muted)'
    if (v > 1.5) return '#ef4444'
    if (v > 0.8) return '#f97316'
    if (v > 0.3) return '#eab308'
    return '#22c55e'
  }

  return (
    <div className="card comparison-section">

      {/* ── Header ── */}
      <div className="comparison-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="comparison-header-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="10" width="3.5" height="7" rx="1" fill="#6366F1" opacity="0.9"/>
              <rect x="6" y="6" width="3.5" height="11" rx="1" fill="#a855f7" opacity="0.9"/>
              <rect x="11" y="3" width="3.5" height="14" rx="1" fill="#22c55e" opacity="0.9"/>
              <path d="M1 2L6 5L11 3.5L17 1" stroke="#6366F1" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <h2 className="comparison-title">Company Comparison</h2>
            <p className="comparison-subtitle">
              {input_company.symbol} vs {peers?.length || 0} sector peers · Real NSE/Yahoo data
            </p>
          </div>
        </div>
        <span className="comparison-badge">
          {all_companies.length} COMPANIES
        </span>
      </div>

      {/* ── Company Legend dots ── */}
      <div className="comparison-legend">
        {all_companies.map(c => (
          <div key={c.symbol} className="comparison-legend-item">
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: colorMap[c.symbol], flexShrink: 0 }} />
            <span style={{ color: c.is_input ? colorMap[c.symbol] : 'var(--text-secondary)', fontWeight: c.is_input ? 600 : 400 }}>
              {c.symbol}
            </span>
            {c.is_input && <Tag label="YOU" color={INPUT_COLOR} />}
          </div>
        ))}
      </div>

      {/* ── Chart switcher tabs ── */}
      <div className="comparison-tabs">
        {Object.entries(CHARTS).map(([key, ch]) => (
          <button
            key={key}
            className={`comparison-tab${activeChart === key ? ' active' : ''}`}
            onClick={() => setActiveChart(key)}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* ── Active Chart ── */}
      <div style={{ marginBottom: '32px' }}>
        <ChartLabel title={`${chart.label} Comparison`} subtitle={chart.subtitle} />
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chart.data} margin={{ top: 5, right: 10, left: -5, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#3d5470', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#1e2d42' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#3d5470', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={chart.fmt}
            />
            <Tooltip
              content={<ChartTooltip formatter={chart.fmt} />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={48}>
              {chart.data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.fill}
                  fillOpacity={entry.isInput ? 1 : 0.65}
                  stroke={entry.isInput ? entry.fill : 'none'}
                  strokeWidth={entry.isInput ? 1.5 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Rankings grid ── */}
      <div style={{ marginBottom: '28px' }}>
        <ChartLabel title="Rankings" subtitle="AI-computed rankings across all companies" />
        <div className="ranking-grid">
          {rankings.map((r, i) => {
            const company = findCompany(r.symbol)
            return (
              <div key={i} className="ranking-card" style={{ borderColor: `${r.color}25` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: '0.68rem', fontWeight: 700, color: r.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {r.label}
                  </span>
                </div>
                {company ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px',
                      background: `${colorMap[company.symbol]}18`,
                      border: `1px solid ${colorMap[company.symbol]}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.75rem',
                      color: colorMap[company.symbol],
                    }}>
                      {company.name.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', fontWeight: 600, color: colorMap[company.symbol], margin: 0 }}>
                        {company.symbol}
                        {company.is_input && <Tag label="YOU" color={INPUT_COLOR} />}
                      </p>
                      <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: '1px 0 0', fontFamily: 'JetBrains Mono' }}>
                        {r.sub}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'JetBrains Mono' }}>N/A</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Comparison Table ── */}
      <div>
        <ChartLabel title="Full Metrics Table" subtitle="All companies · all key metrics · scroll right →" />
        <div className="peer-table-wrapper">
          <table className="peer-table peer-table-sticky">
            <thead>
              <tr>
                <th className="peer-col-sticky">Company</th>
                <th>Rev. Growth</th>
                <th>Profit Growth</th>
                <th>Debt Ratio</th>
                <th>Market Cap</th>
                <th>PE</th>
                <th>Margin</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {all_companies.map(c => (
                <tr key={c.symbol} className={c.is_input ? 'peer-row-input hover-row zebra' : 'hover-row zebra'}>

                  {/* Company (sticky on mobile) */}
                  <td className="peer-col-sticky">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colorMap[c.symbol], flexShrink: 0 }} />
                      <span style={{ color: c.is_input ? INPUT_COLOR : 'var(--text-primary)', fontWeight: c.is_input ? 600 : 400, fontFamily: 'JetBrains Mono', fontSize: '0.78rem' }}>
                        {c.symbol}
                      </span>
                      {c.is_input && <Tag label="INPUT" color={INPUT_COLOR} />}
                    </div>
                  </td>

                  {/* Revenue Growth */}
                  <td>
                    <span style={{ color: growthColor(c.revenue_growth) }}>
                      {c.revenue_growth != null ? `${c.revenue_growth > 0 ? '+' : ''}${c.revenue_growth}%` : '—'}
                    </span>
                    {highlights?.best_revenue_growth === c.symbol && <Tag label="BEST" color="#22c55e" />}
                  </td>

                  {/* Profit Growth */}
                  <td>
                    <span style={{ color: growthColor(c.profit_growth) }}>
                      {c.profit_growth != null ? `${c.profit_growth > 0 ? '+' : ''}${c.profit_growth}%` : '—'}
                    </span>
                    {highlights?.best_profit_growth === c.symbol && <Tag label="BEST" color="#22c55e" />}
                    {highlights?.lowest_profit === c.symbol && <Tag label="LOWEST" color="#ef4444" />}
                  </td>

                  {/* Debt Ratio */}
                  <td>
                    <span style={{ color: debtColor(c.debt_ratio) }}>
                      {c.debt_ratio != null ? `${c.debt_ratio}x` : '—'}
                    </span>
                    {highlights?.highest_debt === c.symbol && <Tag label="HIGH" color="#ef4444" />}
                    {highlights?.lowest_debt === c.symbol && <Tag label="LOW" color="#22c55e" />}
                  </td>

                  {/* Market Cap */}
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {c.market_cap != null ? formatCurrency(c.market_cap) : '—'}
                    {highlights?.highest_market_cap === c.symbol && <Tag label="LARGEST" color="#a855f7" />}
                  </td>

                  {/* PE */}
                  <td style={{ color: 'var(--text-secondary)' }}>{c.pe_ratio != null ? c.pe_ratio : '—'}</td>

                  {/* Margin */}
                  <td style={{ color: c.profit_margin > 0 ? '#22c55e' : '#ef4444' }}>
                    {c.profit_margin != null ? `${c.profit_margin}%` : '—'}
                    {highlights?.best_profit_margin === c.symbol && <Tag label="BEST" color="#6366F1" />}
                  </td>

                  {/* Risk */}
                  <td>
                    <span className="peer-risk-badge" style={{
                      color: RISK_COLORS[c.risk_level] || '#eab308',
                      background: `${RISK_COLORS[c.risk_level] || '#eab308'}12`,
                      borderColor: `${RISK_COLORS[c.risk_level] || '#eab308'}30`,
                    }}>
                      {c.risk_score}
                    </span>
                    {highlights?.lowest_risk === c.symbol && <Tag label="SAFE" color="#22c55e" />}
                    {highlights?.highest_risk === c.symbol && <Tag label="RISKY" color="#ef4444" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
