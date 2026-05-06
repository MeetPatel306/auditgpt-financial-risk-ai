import { useState } from 'react'

const SEVERITY_CONFIG = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.18)', label: 'CRITICAL' },
  HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.18)', label: 'HIGH' },
  MEDIUM:   { color: '#eab308', bg: 'rgba(234,179,8,0.06)',  border: 'rgba(234,179,8,0.18)',  label: 'MEDIUM' },
  LOW:      { color: '#22c55e', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.18)',  label: 'LOW' },
}

const CATEGORY_ICONS = {
  'Cash Flow Quality':  '💧',
  'Debt & Leverage':    '📊',
  'Profitability':      '📉',
  'Revenue & Growth':   '📈',
  'Peer Deviation':     '🔀',
  'Valuation':          '⚖️',
  'Operational':        '⚙️',
}

// FIX 2: Map fraud engine categories → score_explanations categories
const CATEGORY_TO_DIMENSION = {
  'Cash Flow Quality':  'Cash Flow Health',
  'Debt & Leverage':    'Debt Risk',
  'Profitability':      'Profitability',
  'Revenue & Growth':   'Revenue Stability',
  'Valuation':          'Valuation Risk',
  'Operational':        'Capital Efficiency',
}

export default function RedFlags({ data }) {
  const reasons      = data.fraud_details?.reasons        || []
  const flatFlags    = data.red_flags                      || []
  const explanations = data.score_explanations             || []

  const hasStructured = reasons.length > 0
  const totalCount    = hasStructured ? reasons.length : flatFlags.length

  // Build a lookup: dimension name → explanation object
  const explanationMap = {}
  explanations.forEach(exp => { explanationMap[exp.category] = exp })

  if (totalCount === 0) {
    return (
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{
            fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.8rem',
            letterSpacing: '0.1em', color: 'var(--text-muted)',
            textTransform: 'uppercase', margin: 0,
          }}>
            ⚑ Fraud Indicators
          </h3>
          <span style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            color: '#22c55e', fontSize: '0.7rem', padding: '2px 10px',
            borderRadius: '20px', fontFamily: 'JetBrains Mono',
          }}>
            0 FLAGGED
          </span>
        </div>
        <p style={{
          color: 'var(--text-muted)', fontFamily: 'JetBrains Mono',
          fontSize: '0.8rem', textAlign: 'center', padding: '20px',
        }}>
          ✓ NO CRITICAL FLAGS DETECTED
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h3 style={{
          fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.8rem',
          letterSpacing: '0.1em', color: 'var(--text-muted)',
          textTransform: 'uppercase', margin: 0,
        }}>
          ⚑ Fraud Indicators
        </h3>
        <span style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', fontSize: '0.7rem', padding: '2px 10px',
          borderRadius: '20px', fontFamily: 'JetBrains Mono',
        }}>
          {totalCount} FLAGGED
        </span>
      </div>

      {/* Score breakdown bar */}
      {data.fraud_details?.score_breakdown && (
        <ScoreBreakdownBar breakdown={data.fraud_details.score_breakdown} />
      )}

      {/* Structured findings */}
      {hasStructured ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reasons.map((finding, i) => {
            const dimensionKey = CATEGORY_TO_DIMENSION[finding.category]
            const explanation  = dimensionKey ? explanationMap[dimensionKey] : null
            return (
              <StructuredFlag
                key={i}
                finding={finding}
                index={i}
                explanation={explanation}
              />
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
          {flatFlags.map((flag, i) => (
            <PlainFlag key={i} flag={flag} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Score Breakdown Bar ── */
function ScoreBreakdownBar({ breakdown }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const CATEGORY_COLORS = {
    'Cash Flow Quality': '#6366F1',
    'Debt & Leverage':   '#f97316',
    'Profitability':     '#ef4444',
    'Revenue & Growth':  '#22c55e',
    'Peer Deviation':    '#a855f7',
    'Valuation':         '#eab308',
    'Operational':       '#ec4899',
  }

  return (
    <div style={{ marginBottom: '18px' }}>
      <p style={{
        color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px',
      }}>
        Score Breakdown by Category
      </p>
      <div style={{
        display: 'flex', height: '6px', borderRadius: '6px',
        overflow: 'hidden', gap: '1px', marginBottom: '10px',
      }}>
        {Object.entries(breakdown).map(([cat, pts]) => (
          <div
            key={cat}
            title={`${cat}: ${pts}pts`}
            style={{ flex: pts / total, background: CATEGORY_COLORS[cat] || '#888', minWidth: '4px' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {Object.entries(breakdown).map(([cat, pts]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '2px',
              background: CATEGORY_COLORS[cat] || '#888', flexShrink: 0,
            }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontFamily: 'JetBrains Mono' }}>
              {cat} <span style={{ color: CATEGORY_COLORS[cat] || '#888' }}>+{pts}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Structured finding card with FIX 2 expandable "Why?" ── */
function StructuredFlag({ finding, index, explanation }) {
  const [whyOpen, setWhyOpen] = useState(false)
  const cfg  = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.MEDIUM
  const icon = CATEGORY_ICONS[finding.category]  || '⚠'

  return (
    <div
      style={{
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: '8px', overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '12px 14px',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = cfg.bg.replace('0.06', '0.1') }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {/* Index number */}
        <div style={{
          width: '22px', height: '22px', borderRadius: '4px',
          background: `${cfg.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: '1px',
        }}>
          <span style={{
            color: cfg.color, fontSize: '0.62rem',
            fontFamily: 'JetBrains Mono', fontWeight: 700,
          }}>
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '5px', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.72rem' }}>{icon}</span>
            <span style={{
              color: 'var(--text-muted)', fontSize: '0.67rem',
              fontFamily: 'JetBrains Mono', letterSpacing: '0.05em',
            }}>
              {finding.category}
            </span>
            <span style={{
              background: `${cfg.color}18`, color: cfg.color,
              border: `1px solid ${cfg.color}35`,
              fontSize: '0.56rem', fontFamily: 'JetBrains Mono',
              fontWeight: 700, padding: '1px 6px', borderRadius: '3px',
              letterSpacing: '0.06em',
            }}>
              {cfg.label}
            </span>
            <span style={{
              marginLeft: 'auto', color: cfg.color,
              fontSize: '0.62rem', fontFamily: 'JetBrains Mono', opacity: 0.8,
            }}>
              +{finding.points}pts
            </span>
          </div>

          {/* Reason text */}
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, lineHeight: 1.55 }}>
            {finding.reason}
          </p>
        </div>

        {/* FIX 2: Why? toggle button */}
        {explanation && (
          <button
            onClick={() => setWhyOpen(o => !o)}
            title="Why does this matter?"
            style={{
              flexShrink: 0, background: whyOpen ? `${cfg.color}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${whyOpen ? cfg.color + '40' : 'var(--border)'}`,
              borderRadius: '5px', color: whyOpen ? cfg.color : 'var(--text-muted)',
              fontFamily: 'JetBrains Mono', fontSize: '0.6rem', fontWeight: 600,
              padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.04em',
              transition: 'all 0.15s', whiteSpace: 'nowrap', alignSelf: 'flex-start',
            }}
          >
            {whyOpen ? '▲ Hide' : '▼ Why?'}
          </button>
        )}
      </div>

      {/* FIX 2: Expandable "Why?" panel */}
      {whyOpen && explanation && (
        <div style={{
          borderTop: `1px solid ${cfg.border}`,
          background: 'rgba(0,0,0,0.12)',
          padding: '12px 14px 12px 48px',
          animation: 'expandDown 0.18s ease',
        }}>
          <p style={{
            color: 'var(--text-muted)', fontSize: '0.62rem',
            fontFamily: 'JetBrains Mono', letterSpacing: '0.06em',
            textTransform: 'uppercase', margin: '0 0 6px',
          }}>
            Why this matters
          </p>
          <p style={{
            color: 'var(--text-secondary)', fontSize: '0.76rem',
            margin: '0 0 10px', lineHeight: 1.6,
          }}>
            {explanation.explanation}
          </p>

          {/* Dimension score mini bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              color: 'var(--text-muted)', fontSize: '0.62rem',
              fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap',
            }}>
              {explanation.category} score:
            </span>
            <div style={{
              flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)',
              borderRadius: '4px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.round((explanation.score / 95) * 100)}%`,
                background: cfg.color, borderRadius: '4px',
              }} />
            </div>
            <span style={{
              color: cfg.color, fontSize: '0.65rem',
              fontFamily: 'JetBrains Mono', fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              {explanation.score}/95
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes expandDown {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ── Plain string flag (fallback) ── */
function PlainFlag({ flag, index }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)',
        borderRadius: '8px', padding: '12px 14px',
        transition: 'border-color 0.2s, background 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
        e.currentTarget.style.background  = 'rgba(239,68,68,0.07)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)'
        e.currentTarget.style.background  = 'rgba(239,68,68,0.04)'
      }}
    >
      <div style={{
        width: '22px', height: '22px', borderRadius: '4px',
        background: 'rgba(239,68,68,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ color: '#ef4444', fontSize: '0.65rem', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
        {flag}
      </p>
    </div>
  )
}