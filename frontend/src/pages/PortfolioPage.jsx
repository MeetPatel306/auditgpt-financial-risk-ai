import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer,
} from 'recharts'
import Navbar from '../components/Navbar'
import { analyzePortfolio } from '../utils/api'
import { formatCurrency, getRiskConfig } from '../utils/format'
import { getCachedState, setCachedState } from '../utils/viewStateCache'

/* ── Colour helpers ──────────────────────────────────────────────────── */
const RISK_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#eab308', LOW: '#22c55e' }
const RISK_ORDER  = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 }
const SENTIMENT_COLOR = { positive: '#22c55e', neutral: '#6366F1', negative: '#ef4444' }

function riskColor(level) { return RISK_COLORS[level] || '#eab308' }

/* ── Tag input component ─────────────────────────────────────────────── */
function TagInput({ tags, onAdd, onRemove, onAnalyze, loading }) {
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef(null)

  function handleKey(e) {
    if ((e.key === 'Enter' || e.key === ',') && inputVal.trim()) {
      e.preventDefault()
      addTag(inputVal)
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      onRemove(tags[tags.length - 1])
    }
  }

  function addTag(val) {
    const parts = val.split(',').map(v => v.trim().toUpperCase()).filter(Boolean)
    parts.forEach(p => { if (p && !tags.includes(p)) onAdd(p) })
    setInputVal('')
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    addTag(text)
  }

  const EXAMPLES = ['TCS', 'INFY', 'RELIANCE', 'HDFCBANK', 'WIPRO']

  return (
    <div>
      {/* Tag input row */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
          padding: '12px 16px', background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border)', borderRadius: '10px',
          minHeight: '52px', cursor: 'text',
          transition: 'border-color 0.2s',
        }}
        onFocus={() => {}}
      >
        {tags.map(tag => (
          <span key={tag} style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
            color: '#6366F1', padding: '3px 10px', borderRadius: '5px',
            fontFamily: 'JetBrains Mono', fontSize: '0.72rem', fontWeight: 600,
          }}>
            {tag}
            <span
              onClick={e => { e.stopPropagation(); onRemove(tag) }}
              style={{ cursor: 'pointer', opacity: 0.6, fontWeight: 400, fontSize: '0.9rem', lineHeight: 1 }}
            >×</span>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => setInputVal(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          onBlur={() => { if (inputVal.trim()) addTag(inputVal) }}
          placeholder={tags.length === 0 ? 'Enter NSE symbols (e.g. TCS, INFY, RELIANCE)…' : ''}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'JetBrains Mono',
            fontSize: '0.82rem', minWidth: '180px', flex: 1,
          }}
          disabled={loading || tags.length >= 10}
        />
      </div>

      {/* Hint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '6px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono' }}>
          Press <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>Enter</kbd> or <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>,</kbd> to add · Max 10 companies · Paste a comma-separated list
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono' }}>
          {tags.length}/10 added
        </p>
      </div>

      {/* Quick-add examples */}
      {tags.length === 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono', lineHeight: '24px' }}>Try:</span>
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => onAdd(ex)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', padding: '2px 10px', borderRadius: '5px',
                fontFamily: 'JetBrains Mono', fontSize: '0.65rem', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366F150'; e.currentTarget.style.color = '#6366F1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >{ex}</button>
          ))}
        </div>
      )}

      {/* Analyze button */}
      <button
        onClick={onAnalyze}
        disabled={tags.length < 2 || loading}
        className="btn-primary"
        style={{ marginTop: '16px', width: '100%', padding: '12px', fontSize: '0.82rem' }}
      >
        {loading ? (
          <>
            <span style={{ width: '14px', height: '14px', border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            Analyzing {tags.length} companies…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="7" cy="10" r="0.75" fill="currentColor"/>
            </svg>
            Analyze Portfolio ({tags.length} {tags.length === 1 ? 'company' : 'companies'})
          </>
        )}
      </button>
    </div>
  )
}

/* ── Summary cards ───────────────────────────────────────────────────── */
function SummaryCards({ summary }) {
  const avgRisk = getRiskConfig(summary.average_risk_level)

  const cards = [
    {
      label: 'Portfolio Risk Score',
      value: summary.average_fraud_score,
      sub: summary.average_risk_level + ' RISK',
      subColor: riskColor(summary.average_risk_level),
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L3 5V9C3 12.3 5.8 15.4 9 16.5C12.2 15.4 15 12.3 15 9V5L9 2Z" stroke="#6366F1" strokeWidth="1.5" fill="none"/>
          <path d="M6 9l2 2 4-4" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      accent: '#6366F1',
    },
    {
      label: 'Highest Risk Company',
      value: summary.highest_risk.nse_symbol,
      sub: `Score: ${summary.highest_risk.fraud_score} · ${summary.highest_risk.risk_level}`,
      subColor: riskColor(summary.highest_risk.risk_level),
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 3L16 15H2L9 3Z" stroke="#ef4444" strokeWidth="1.5" fill="none"/>
          <path d="M9 8v3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="9" cy="13" r="0.8" fill="#ef4444"/>
        </svg>
      ),
      accent: '#ef4444',
    },
    {
      label: 'Lowest Risk Company',
      value: summary.lowest_risk.nse_symbol,
      sub: `Score: ${summary.lowest_risk.fraud_score} · ${summary.lowest_risk.risk_level}`,
      subColor: riskColor(summary.lowest_risk.risk_level),
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="6.5" stroke="#22c55e" strokeWidth="1.5" fill="none"/>
          <path d="M6 9l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      accent: '#22c55e',
    },
    {
      label: 'Companies Analyzed',
      value: `${summary.total_companies}/${summary.total_companies + summary.failed_companies}`,
      sub: summary.failed_companies > 0 ? `${summary.failed_companies} failed validation` : 'All validated ✓',
      subColor: summary.failed_companies > 0 ? '#f97316' : '#22c55e',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="3" width="14" height="12" rx="2" stroke="#a855f7" strokeWidth="1.5" fill="none"/>
          <path d="M6 8h6M6 11h4" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      accent: '#a855f7',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c, i) => (
        <div key={i} className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{c.label}</p>
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px',
              background: `${c.accent}12`, border: `1px solid ${c.accent}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{c.icon}</div>
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Poppins', color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1 }}>{c.value}</p>
          <p style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono', color: c.subColor, margin: 0 }}>{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

/* ── Risk distribution bar ───────────────────────────────────────────── */
function RiskDistributionBar({ dist, total }) {
  const order = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW']
  const segments = order.map(k => ({ level: k, count: dist[k] || 0, color: RISK_COLORS[k] })).filter(s => s.count > 0)

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>Risk Distribution</p>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', gap: '2px', marginBottom: '12px' }}>
        {segments.map(s => (
          <div key={s.level} style={{
            flex: s.count / total, background: s.color, borderRadius: '3px', opacity: 0.85,
            transition: 'flex 0.4s ease',
          }} />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {order.map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: RISK_COLORS[k] }} />
            <span style={{ color: dist[k] ? RISK_COLORS[k] : 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono' }}>
              {k} ({dist[k] || 0})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Score bar chart ─────────────────────────────────────────────────── */
function ScoreChart({ companies }) {
  const data = [...companies]
    .sort((a, b) => b.fraud_score - a.fraud_score)
    .map(c => ({ name: c.nse_symbol, score: c.fraud_score, level: c.risk_level }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]
    const level = data.find(x => x.name === label)?.level
    return (
      <div style={{
        background: '#0d1420', border: `1px solid ${riskColor(level)}40`,
        borderRadius: '8px', padding: '10px 14px',
        fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
      }}>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 4px' }}>{label}</p>
        <p style={{ color: riskColor(level), fontWeight: 700, margin: 0, fontSize: '1rem' }}>
          {d.value} <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>/ 100</span>
        </p>
        <p style={{ color: riskColor(level), margin: '2px 0 0', fontSize: '0.62rem' }}>{level} RISK</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>Fraud Score Comparison</p>
      <div className="chart-scroll-wrapper">
        <div style={{ minWidth: 400 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#3d5470', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#3d5470', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d, i) => (
              <Cell key={i} fill={riskColor(d.level)} fillOpacity={0.8} />
            ))}
          </Bar>
          </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/* ── Company table ───────────────────────────────────────────────────── */
function CompanyTable({ companies, onDrillDown }) {
  const [sortKey, setSortKey] = useState('fraud_score')
  const [sortDir, setSortDir] = useState('desc')

  function sort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...companies].sort((a, b) => {
    const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const TH = ({ label, k }) => (
    <th
      onClick={() => sort(k)}
      style={{
        padding: '10px 12px', background: 'rgba(0,0,0,0.2)',
        color: sortKey === k ? '#6366F1' : 'var(--text-muted)',
        fontSize: '0.62rem', fontFamily: 'JetBrains Mono', textTransform: 'uppercase',
        letterSpacing: '0.06em', textAlign: 'left', cursor: 'pointer',
        borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="card" style={{ padding: '20px 0 0' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px', padding: '0 22px' }}>
        Portfolio Holdings — Click a row to drill down
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <TH label="Company"       k="company_name" />
              <TH label="Symbol"        k="nse_symbol"   />
              <TH label="Sector"        k="sector"       />
              <TH label="Risk Score"    k="fraud_score"  />
              <TH label="Risk Level"    k="risk_level"   />
              <TH label="Margin %"      k="profit_margin"/>
              <TH label="Market Cap"    k="market_cap"   />
              <TH label="PE"            k="pe_ratio"     />
              <TH label="Red Flags"     k="red_flags_count"/>
              <TH label="Sentiment"     k="auditor_sentiment"/>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, idx) => {
              const rc = riskColor(c.risk_level)
              const isWorst = c.fraud_score === Math.max(...companies.map(x => x.fraud_score))
              const isBest  = c.fraud_score === Math.min(...companies.map(x => x.fraud_score))
              return (
                <tr
                  key={c.nse_symbol}
                  onClick={() => onDrillDown(c)}
                  className="hover-row zebra"
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ padding: '11px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isWorst && <span title="Highest Risk" style={{ color: '#ef4444', fontSize: '0.65rem' }}>⚑</span>}
                      {isBest  && <span title="Lowest Risk"  style={{ color: '#22c55e', fontSize: '0.65rem' }}>★</span>}
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 500 }}>{c.company_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ color: '#6366F1', fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>{c.nse_symbol}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{c.sector}</td>
                  <td style={{ padding: '11px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                        <div style={{ width: `${c.fraud_score}%`, height: '100%', background: rc, borderRadius: '2px', opacity: 0.85 }} />
                      </div>
                      <span style={{ color: rc, fontFamily: 'JetBrains Mono', fontSize: '0.78rem', fontWeight: 700 }}>{c.fraud_score}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{
                      background: `${rc}18`, color: rc, border: `1px solid ${rc}30`,
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.62rem',
                      fontFamily: 'JetBrains Mono', fontWeight: 700,
                    }}>{c.risk_level}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: c.profit_margin >= 15 ? '#22c55e' : c.profit_margin > 0 ? 'var(--text-secondary)' : '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', fontWeight: 600 }}>
                    {c.profit_margin != null ? c.profit_margin + '%' : '—'}
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', fontSize: '0.75rem' }}>
                    {c.market_cap ? formatCurrency(c.market_cap) : '—'}
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', fontSize: '0.75rem' }}>
                    {c.pe_ratio != null ? c.pe_ratio + 'x' : '—'}
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ color: c.red_flags_count >= 3 ? '#ef4444' : c.red_flags_count >= 1 ? '#eab308' : '#22c55e', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', fontWeight: 700 }}>
                      {c.red_flags_count}
                    </span>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{
                      color: SENTIMENT_COLOR[c.auditor_sentiment] || 'var(--text-muted)',
                      fontSize: '0.72rem', fontFamily: 'JetBrains Mono', textTransform: 'capitalize',
                    }}>
                      {c.auditor_sentiment || '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Failed companies banner ─────────────────────────────────────────── */
function FailedBanner({ failed }) {
  if (!failed?.length) return null
  return (
    <div style={{
      background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)',
      borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
    }}>
      <p style={{ color: '#eab308', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', fontWeight: 600, margin: '0 0 4px' }}>
        ⚠ {failed.length} company/companies could not be validated on NSE:
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>
        {failed.map(f => `"${f.input}" — ${f.error}`).join(' · ')}
      </p>
    </div>
  )
}

/* ── Main Portfolio page ─────────────────────────────────────────────── */
export default function PortfolioPage() {
  const cached = getCachedState('portfolioPage')
  const [tags, setTags]       = useState(cached?.tags || [])
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(cached?.result || null)
  const [error, setError]     = useState(cached?.error || null)
  const navigate              = useNavigate()

  useEffect(() => {
    setCachedState('portfolioPage', { tags, result, error })
  }, [tags, result, error])

  function addTag(t)    { if (!tags.includes(t) && tags.length < 10) setTags(prev => [...prev, t]) }
  function removeTag(t) { setTags(prev => prev.filter(x => x !== t)) }

  async function handleAnalyze() {
    if (tags.length < 2) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await analyzePortfolio(tags)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleDrillDown(company) {
    // Navigate to dashboard with the company pre-loaded
    navigate(`/?company=${company.nse_symbol}`)
  }

  const summary  = result?.portfolio_summary
  const companies = result?.companies || []

  return (
    <div className="min-h-screen grid-bg" style={{ background: 'var(--bg-primary)' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(168,85,247,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <Navbar />
      <main className="page-container relative z-10 max-w-screen-xl mx-auto px-4 md:px-8 py-8">

        {/* Page title + nav back */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontFamily: 'Poppins', fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-primary)', margin: 0 }}>
              Portfolio <span style={{ color: '#a855f7' }}>Risk Analysis</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', margin: '4px 0 0' }}>
              Analyze up to 10 NSE companies simultaneously
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', padding: '7px 14px', borderRadius: '7px',
              fontFamily: 'JetBrains Mono', fontSize: '0.68rem', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366F150'; e.currentTarget.style.color = '#6366F1' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            ← Single Company
          </button>
        </div>

        {/* Input card */}
        <div className="card fade-in-up" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '7px',
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="3" width="13" height="10" rx="1.5" stroke="#a855f7" strokeWidth="1.4" fill="none"/>
                <path d="M5 7h5M5 10h3" stroke="#a855f7" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>
              Add Companies
            </h3>
          </div>
          <TagInput
            tags={tags}
            onAdd={addTag}
            onRemove={removeTag}
            onAnalyze={handleAnalyze}
            loading={loading}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px', padding: '14px 18px', marginBottom: '18px',
          }}>
            <p style={{ color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* Loading overlay placeholder */}
        {loading && (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-primary)', fontFamily: 'Poppins', fontWeight: 700, fontSize: '1rem', margin: '0 0 6px' }}>
              Analyzing {tags.length} companies in parallel…
            </p>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', margin: 0 }}>
              Fetching real financial data from Yahoo Finance · NSE validation · Fraud scoring
            </p>
          </div>
        )}

        {/* Results */}
        {result && !loading && summary && (
          <div className="space-y-6">
            {/* Summary banner */}
            <div className="fade-in-up" style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(99,102,241,0.04))',
              border: '1px solid rgba(168,85,247,0.2)', borderRadius: '12px',
              padding: '16px 20px', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0 0 2px' }}>
                  Portfolio Risk Overview
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', margin: 0 }}>
                  {summary.total_companies} companies · Analyzed {new Date(result.analyzed_at).toLocaleString()}
                </p>
              </div>
              <span style={{
                background: `${riskColor(summary.average_risk_level)}15`,
                color: riskColor(summary.average_risk_level),
                border: `1px solid ${riskColor(summary.average_risk_level)}30`,
                padding: '6px 18px', borderRadius: '20px',
                fontFamily: 'JetBrains Mono', fontSize: '0.75rem', fontWeight: 700,
              }}>
                AVG RISK: {summary.average_risk_level} ({summary.average_fraud_score} / 100)
              </span>
            </div>

            {/* 4 KPI cards */}
            <SummaryCards summary={summary} />

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ScoreChart companies={companies} />
              <RiskDistributionBar dist={summary.risk_distribution} total={summary.total_companies} />
            </div>

            {/* Failed banner */}
            <FailedBanner failed={result.failed} />

            {/* Company table */}
            <CompanyTable companies={companies} onDrillDown={handleDrillDown} />

            {/* Re-analyze button */}
            <div style={{ textAlign: 'center', paddingBottom: '32px' }}>
              <button
                onClick={() => { setResult(null); setTags([]) }}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', padding: '8px 20px', borderRadius: '7px',
                  fontFamily: 'JetBrains Mono', fontSize: '0.7rem', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#a855f750'; e.currentTarget.style.color = '#a855f7' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                ↺ New Portfolio Analysis
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
