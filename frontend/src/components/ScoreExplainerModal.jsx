import { useEffect } from 'react'

const LEVEL_CONFIG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'CRITICAL' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', label: 'HIGH' },
  moderate: { color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.2)',  label: 'MODERATE' },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)',  label: 'LOW' },
}

const CATEGORY_ICONS = {
  'Revenue Stability':  '📈',
  'Profitability':      '📉',
  'Debt Risk':          '📊',
  'Cash Flow Health':   '💧',
  'Valuation Risk':     '⚖️',
  'Capital Efficiency': '⚙️',
}

export default function ScoreExplainerModal({ data, onClose }) {
  const explanations   = data.score_explanations || []
  const scoreBreakdown = data.fraud_details?.score_breakdown || {}
  const totalPoints    = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0)

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.18s ease',
        }}
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Score Explanation"
        style={{
          position: 'fixed', zIndex: 1001,
          top: '55%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(680px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: '14px',
          padding: '28px',
          animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <h2 style={{
              fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1rem',
              color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '0.04em',
            }}>
              Score Explainer
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', margin: 0 }}>
              {data.company_name} · Fraud Score: {data.fraud_score}/100 · {explanations.length} dimensions
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              borderRadius: '6px', color: 'var(--text-muted)',
              width: '30px', height: '30px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', flexShrink: 0, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* How scoring works — methodology note */}
        <div style={{
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)',
          borderRadius: '8px', padding: '12px 14px', marginBottom: '22px',
        }}>
          <p style={{ color: '#6366F1', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', fontWeight: 600, margin: '0 0 4px', letterSpacing: '0.06em' }}>
            HOW THE SCORE IS CALCULATED
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, lineHeight: 1.6 }}>
            Each dimension scores 0–95 based on financial metric analysis. Points are added to the total fraud score when anomalies are detected. A score above 70 indicates high risk. The final score is capped at 95.
          </p>
        </div>

        {/* Dimension table */}
        {explanations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
            {explanations.map((exp, i) => {
              const cfg  = LEVEL_CONFIG[exp.level] || LEVEL_CONFIG.low
              const icon = CATEGORY_ICONS[exp.category] || '📌'
              const pct  = Math.round((exp.score / 95) * 100)

              return (
                <div
                  key={i}
                  style={{
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                    borderRadius: '10px', padding: '14px 16px',
                  }}
                >
                  {/* Row 1: icon + name + level badge + score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                    <span style={{
                      fontFamily: 'Poppins, sans-serif', fontWeight: 700,
                      fontSize: '0.78rem', color: 'var(--text-primary)', flex: 1,
                    }}>
                      {exp.category}
                    </span>
                    <span style={{
                      background: `${cfg.color}18`, color: cfg.color,
                      border: `1px solid ${cfg.color}35`,
                      fontSize: '0.56rem', fontFamily: 'JetBrains Mono',
                      fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                      letterSpacing: '0.06em',
                    }}>
                      {cfg.label}
                    </span>
                    <span style={{
                      fontFamily: 'JetBrains Mono', fontWeight: 700,
                      fontSize: '0.85rem', color: cfg.color,
                    }}>
                      {exp.score}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/95</span>
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: '4px', background: 'rgba(255,255,255,0.08)',
                    borderRadius: '4px', overflow: 'hidden', marginBottom: '10px',
                  }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: cfg.color, borderRadius: '4px',
                      transition: 'width 0.8s ease',
                    }} />
                  </div>

                  {/* Explanation text */}
                  <p style={{
                    color: 'var(--text-secondary)', fontSize: '0.75rem',
                    margin: '0 0 8px', lineHeight: 1.55,
                  }}>
                    {exp.explanation}
                  </p>

                  {/* Points contributed */}
                  {exp.points > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontFamily: 'JetBrains Mono' }}>
                        Contributed to total score:
                      </span>
                      <span style={{
                        color: cfg.color, fontSize: '0.62rem',
                        fontFamily: 'JetBrains Mono', fontWeight: 700,
                      }}>
                        +{exp.points} pts
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', textAlign: 'center', padding: '20px 0' }}>
            No dimension data available.
          </p>
        )}

        {/* Total points summary */}
        {totalPoints > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '12px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: '8px',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono' }}>
              Total risk points accumulated
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: '0.9rem',
              color: data.fraud_score >= 70 ? '#ef4444' : data.fraud_score >= 45 ? '#eab308' : '#22c55e',
            }}>
              {totalPoints} pts → Score {data.fraud_score}/100
            </span>
          </div>
        )}

        {/* Close button */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
              color: '#6366F1', fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
              fontWeight: 600, padding: '8px 20px', borderRadius: '8px',
              cursor: 'pointer', letterSpacing: '0.04em', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -46%) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
    </>
  )
}