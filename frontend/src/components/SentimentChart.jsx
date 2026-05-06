import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts'

/* ── Sentiment config ────────────────────────────────────────────────── */
const SENTIMENT_CONFIG = {
  positive: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   icon: '↑', label: 'Positive' },
  neutral:  { color: '#6366F1', bg: 'rgba(99,102,241,0.08)',   border: 'rgba(99,102,241,0.25)',   icon: '→', label: 'Neutral'  },
  negative: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   icon: '↓', label: 'Negative' },
}

const TREND_CONFIG = {
  improving:    { color: '#22c55e', icon: '↑', label: 'Improving' },
  stable:       { color: '#6366F1', icon: '→', label: 'Stable'    },
  deteriorating:{ color: '#ef4444', icon: '↓', label: 'Deteriorating' },
}

/* ── Custom tooltip ──────────────────────────────────────────────────── */
function SentimentTooltip({ active, payload, label, yearly }) {
  if (!active || !payload?.length) return null
  const year = label
  const yd   = yearly?.find(y => y.year === year)
  if (!yd) return null
  const cfg = SENTIMENT_CONFIG[yd.sentiment] || SENTIMENT_CONFIG.neutral

  return (
    <div style={{
      background: '#0d1420', border: `1px solid ${cfg.color}40`,
      borderRadius: '10px', padding: '12px 14px', maxWidth: '280px',
      fontFamily: 'JetBrains Mono', fontSize: '0.7rem',
      boxShadow: `0 4px 20px ${cfg.color}15`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ color: 'var(--text-muted)' }}>FY {year}</span>
        <span style={{
          background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30`,
          padding: '1px 7px', borderRadius: '4px', fontWeight: 600, fontSize: '0.65rem',
        }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
      <div style={{ color: cfg.color, fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px' }}>
        Score: {yd.chart_score}/100
      </div>
      {yd.keywords?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>KEY SIGNALS: </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.62rem' }}>
            {yd.keywords.slice(0, 3).join(', ')}
          </span>
        </div>
      )}
      {yd.note && (
        <p style={{
          color: 'var(--text-secondary)', fontSize: '0.65rem', margin: 0,
          lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '8px',
        }}>
          {yd.note.slice(0, 140)}…
        </p>
      )}
    </div>
  )
}

/* ── Custom dot ──────────────────────────────────────────────────────── */
function SentimentDot({ cx, cy, payload, yearly }) {
  const yd  = yearly?.find(y => y.year === payload?.year)
  const cfg = yd ? SENTIMENT_CONFIG[yd.sentiment] : SENTIMENT_CONFIG.neutral
  return (
    <circle
      cx={cx} cy={cy} r={5}
      fill={cfg.color} stroke="#0d1420" strokeWidth={2}
      style={{ filter: `drop-shadow(0 0 4px ${cfg.color}80)` }}
    />
  )
}

/* ── Main Component ──────────────────────────────────────────────────── */
export default function SentimentChart({ data }) {
  const [activeYear, setActiveYear] = useState(null)

  const sentiment = data?.auditor_sentiment
  if (!sentiment?.yearly?.length) return null

  const { yearly, overall_sentiment, trend, risk_flag, risk_reason } = sentiment

  const overallCfg = SENTIMENT_CONFIG[overall_sentiment] || SENTIMENT_CONFIG.neutral
  const trendCfg   = TREND_CONFIG[trend] || TREND_CONFIG.stable

  // Chart data
  const chartData = yearly.map(y => ({
    year:         y.year,
    score:        y.chart_score,
    sentiment:    y.sentiment,
  }))

  // Active year note
  const activeYd = activeYear ? yearly.find(y => y.year === activeYear) : yearly[yearly.length - 1]
  const activeCfg = activeYd ? SENTIMENT_CONFIG[activeYd.sentiment] : SENTIMENT_CONFIG.neutral

  // Gradient color based on overall
  const areaColor = risk_flag ? '#ef4444' : (overall_sentiment === 'positive' ? '#22c55e' : '#6366F1')

  return (
    <div className="card" style={{ padding: '24px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: `linear-gradient(135deg, ${overallCfg.bg}, rgba(0,0,0,0.3))`,
            border: `1px solid ${overallCfg.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12L6 7L9 10L14 4" stroke={overallCfg.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6" cy="7" r="1.5" fill={overallCfg.color}/>
              <circle cx="9" cy="10" r="1.5" fill={overallCfg.color}/>
              <circle cx="14" cy="4" r="1.5" fill={overallCfg.color}/>
            </svg>
          </div>
          <div>
            <h3 style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>
              Auditor Sentiment Analysis
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', margin: '2px 0 0' }}>
              NLP analysis · {yearly.length} year{yearly.length > 1 ? 's' : ''} of auditor notes
            </p>
          </div>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{
            background: overallCfg.bg, border: `1px solid ${overallCfg.border}`,
            color: overallCfg.color, fontSize: '0.65rem', padding: '3px 10px',
            borderRadius: '20px', fontFamily: 'JetBrains Mono', fontWeight: 600,
          }}>
            {overallCfg.icon} {overallCfg.label.toUpperCase()}
          </span>
          <span style={{
            background: `${trendCfg.color}10`, border: `1px solid ${trendCfg.color}25`,
            color: trendCfg.color, fontSize: '0.65rem', padding: '3px 10px',
            borderRadius: '20px', fontFamily: 'JetBrains Mono',
          }}>
            {trendCfg.icon} {trendCfg.label}
          </span>
        </div>
      </div>

      {/* ── Risk flag banner ── */}
      {risk_flag && risk_reason && (
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '18px',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚑</span>
          <div>
            <p style={{ color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.7rem', fontWeight: 600, margin: '0 0 3px' }}>
              SENTIMENT RISK FLAG
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
              {risk_reason}
            </p>
          </div>
        </div>
      )}

      {/* ── Year summary pills ── */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {yearly.map(y => {
          const cfg = SENTIMENT_CONFIG[y.sentiment] || SENTIMENT_CONFIG.neutral
          const isActive = activeYear === y.year || (!activeYear && y === yearly[yearly.length - 1])
          return (
            <button
              key={y.year}
              onClick={() => setActiveYear(y.year === activeYear ? null : y.year)}
              style={{
                background: isActive ? cfg.bg : 'transparent',
                border: `1px solid ${isActive ? cfg.color : 'var(--border)'}`,
                color: isActive ? cfg.color : 'var(--text-muted)',
                padding: '4px 10px', borderRadius: '6px',
                fontFamily: 'JetBrains Mono', fontSize: '0.68rem', cursor: 'pointer',
                transition: 'all 0.15s ease', fontWeight: isActive ? 600 : 400,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.color = cfg.color }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = isActive ? cfg.color : 'var(--border)'
                e.currentTarget.style.color = isActive ? cfg.color : 'var(--text-muted)'
              }}
            >
              FY{y.year} {cfg.icon}
            </button>
          )
        })}
      </div>

      {/* ── Area Chart ── */}
      <div style={{ marginBottom: '20px' }}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={areaColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={areaColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: '#3d5470', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#1e2d42' }} tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#3d5470', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}`}
            />
            {/* Neutral line at 50 */}
            <ReferenceLine y={50} stroke="#3d5470" strokeDasharray="4 4" strokeOpacity={0.6} />
            {/* Negative threshold at 35 */}
            <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="2 4" strokeOpacity={0.4}
              label={{ value: 'Risk Zone', position: 'insideTopLeft', fill: '#ef4444', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            />
            <Tooltip
              content={(props) => <SentimentTooltip {...props} yearly={yearly} />}
              cursor={{ stroke: areaColor, strokeOpacity: 0.3, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke={areaColor}
              strokeWidth={2.5}
              fill="url(#sentGrad)"
              dot={(props) => {
                const { key, ...dotProps } = props || {}
                return <SentimentDot key={key} {...dotProps} yearly={yearly} />
              }}
              activeDot={{ r: 7, fill: areaColor, stroke: '#0d1420', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '0 4px' }}>
          <span style={{ color: '#3d5470', fontSize: '0.6rem', fontFamily: 'JetBrains Mono' }}>← NEGATIVE (0)&nbsp;&nbsp;&nbsp;NEUTRAL (50)&nbsp;&nbsp;&nbsp;POSITIVE (100) →</span>
          <span style={{ color: '#3d5470', fontSize: '0.6rem', fontFamily: 'JetBrains Mono' }}>Score Scale</span>
        </div>
      </div>

      {/* ── Active Year Note ── */}
      {activeYd && (
        <div style={{
          background: `${activeCfg.color}06`, border: `1px solid ${activeCfg.color}20`,
          borderRadius: '8px', padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.75rem', color: activeCfg.color }}>
                FY {activeYd.year}
              </span>
              <span style={{
                background: `${activeCfg.color}15`, color: activeCfg.color,
                border: `1px solid ${activeCfg.color}30`,
                fontSize: '0.6rem', padding: '1px 7px', borderRadius: '4px',
                fontFamily: 'JetBrains Mono', fontWeight: 600,
              }}>
                {activeCfg.icon} {activeCfg.label}  ·  {activeYd.chart_score}/100
              </span>
            </div>
            {activeYd.keywords?.length > 0 && (
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {activeYd.keywords.slice(0, 4).map((kw, i) => (
                  <span key={i} style={{
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', fontSize: '0.58rem', padding: '1px 6px',
                    borderRadius: '3px', fontFamily: 'JetBrains Mono',
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p style={{
            color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0,
            lineHeight: 1.65, fontStyle: 'italic',
          }}>
            "{activeYd.note}"
          </p>
        </div>
      )}
    </div>
  )
}
