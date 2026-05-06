import { useState } from 'react'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts'
import { formatCurrency } from '../utils/format'

const TABS = [
  { key: 'overview',  label: 'Overview'        },
  { key: 'revenue',   label: 'Revenue'          },
  { key: 'profit',    label: 'Profit'           },
  { key: 'debt',      label: 'Debt & Cash Flow' },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(10,17,32,0.97)', border: '1px solid #1e2d42',
      borderRadius: 10, padding: '12px 16px',
      fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.65rem' }}>FY {label}</p>
      {payload.map((p, i) => (
        p.value !== null && p.value !== undefined && (
          <p key={i} style={{ color: p.color, margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
            <span style={{ fontWeight: 700 }}>{formatCurrency(p.value)}</span>
          </p>
        )
      ))}
    </div>
  )
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
        color: active ? '#6366F1' : 'var(--text-muted)',
        fontFamily: 'JetBrains Mono', fontSize: '0.65rem', fontWeight: active ? 600 : 400,
        letterSpacing: '0.04em', transition: 'all 0.15s',
        borderBottom: active ? '2px solid #6366F1' : '2px solid transparent',
      }}
    >{label}</button>
  )
}

const axisStyle = { fill: '#3d5470', fontSize: 10, fontFamily: 'JetBrains Mono' }

export default function RevenueChart({ data }) {
  const [tab, setTab] = useState('overview')

  const years    = data.years        || []
  const revenue  = data.revenue_10y  || []
  const profit   = data.profit_10y   || []
  const debt     = data.debt_10y     || []
  const cashflow = data.cashflow_10y || []

  // FIX 3: Use null for missing values so Recharts skips them gracefully
  // instead of rendering 0 bars which is misleading
  const chartData = years.map((yr, i) => ({
    year:     yr,
    Revenue:  revenue[i]  ?? null,
    Profit:   profit[i]   ?? null,
    Debt:     debt[i]     ?? null,
    CashFlow: cashflow[i] ?? null,
    anomaly:  data.revenue_trend?.[i]?.anomaly || false,
  }))

  // FIX 3: Dynamic year range label
  const yearCount   = years.length
  const yearRange   = yearCount >= 2 ? `${years[0]}–${years[years.length - 1]}` : ''
  const sourceLabel = (data.financial_data_sources?.length
    ? data.financial_data_sources.join(' + ').toUpperCase()
    : 'YAHOO')
  const periodLabel = yearCount >= 8
    ? `${yearCount}-year trend`
    : yearCount >= 4
      ? `${yearCount}-year data`
      : yearCount > 0
        ? `${yearCount} year(s) available`
        : 'No data'

  // FIX 3: Sparse data notice — show when <4 years available
  const isSparse = yearCount > 0 && yearCount < 4

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>
            Financial Trend
          </p>
          {/* FIX 3: Dynamic subtitle showing actual years available */}
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>
            Financials ({yearCount} Years){yearRange ? ` · ${yearRange}` : ''} · {sourceLabel}
          </p>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)' }}>
          {TABS.map(t => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} label={t.label} />
          ))}
        </div>
      </div>

      {/* FIX 3: Sparse data warning */}
      {isSparse && (
        <div style={{
          marginBottom: 14,
          background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)',
          borderRadius: 6, padding: '7px 12px',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ color: '#eab308', fontSize: '0.72rem' }}>⚠</span>
          <span style={{ color: '#eab308', fontSize: '0.65rem', fontFamily: 'JetBrains Mono' }}>
            Only {yearCount} year(s) of data available — chart accuracy is limited. Company may be recently listed.
          </span>
        </div>
      )}

      {/* FIX 3: No data fallback */}
      {yearCount === 0 ? (
        <div style={{
          height: 270, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.15)', borderRadius: 8, border: '1px dashed var(--border)',
        }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.75rem' }}>
            No financial data available for this symbol
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={270}>
          {tab === 'overview' ? (
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={axisStyle} axisLine={{ stroke: '#1e2d42' }} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
              {/* FIX 3: connectNulls=false so gaps show as missing, not zero */}
              <Bar dataKey="Revenue" fill="#22c55e" fillOpacity={0.65} radius={[3,3,0,0]} maxBarSize={24} />
              <Bar dataKey="Profit"  fill="#6366F1" fillOpacity={0.65} radius={[3,3,0,0]} maxBarSize={24} />
              <Line type="monotone" dataKey="Debt"     stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="CashFlow" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 3 }} connectNulls={false} />
              {chartData.map((d, i) => d.anomaly ? (
                <ReferenceDot key={i} x={d.year} y={d.Revenue} r={6} fill="#ef4444" stroke="#080c14" strokeWidth={2} />
              ) : null)}
            </ComposedChart>
          ) : tab === 'revenue' ? (
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={axisStyle} axisLine={{ stroke: '#1e2d42' }} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
              <Area type="monotone" dataKey="Revenue" stroke="#22c55e" strokeWidth={2.5} fill="url(#revGrad2)" dot={{ fill: '#22c55e', r: 3.5, strokeWidth: 0 }} connectNulls={false} />
            </ComposedChart>
          ) : tab === 'profit' ? (
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="prfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={axisStyle} axisLine={{ stroke: '#1e2d42' }} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
              <Area type="monotone" dataKey="Profit" stroke="#6366F1" strokeWidth={2.5} fill="url(#prfGrad)" dot={{ fill: '#6366F1', r: 3.5, strokeWidth: 0 }} connectNulls={false} />
            </ComposedChart>
          ) : (
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={axisStyle} axisLine={{ stroke: '#1e2d42' }} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
              <Line type="monotone" dataKey="Debt"     stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 3.5 }} connectNulls={false} />
              <Line type="monotone" dataKey="CashFlow" stroke="#a855f7" strokeWidth={2.5} dot={{ fill: '#a855f7', r: 3.5 }} connectNulls={false} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        {[['Revenue','#22c55e'], ['Profit','#6366F1'], ['Debt','#f97316'], ['Cash Flow','#a855f7']].map(([l, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono' }}>{l}</span>
          </div>
        ))}
        {data.anomaly_flags?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ color: '#ef4444', fontSize: '0.65rem', fontFamily: 'JetBrains Mono' }}>
              {data.anomaly_flags.length} Anomalies
            </span>
          </div>
        )}
      </div>
    </div>
  )
}