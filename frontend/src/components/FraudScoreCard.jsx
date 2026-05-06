import { useEffect, useState } from 'react'
import { getRiskConfig } from '../utils/format'
import ScoreExplainerModal from './Scoreexplainermodal'

export default function FraudScoreCard({ data }) {
  const [animated,    setAnimated]    = useState(false)
  const [modalOpen,   setModalOpen]   = useState(false)

  const risk  = getRiskConfig(data.risk_level)
  const score = data.fraud_score
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [data])

  const reasons       = data.fraud_details?.reasons        || []
  const breakdown     = data.fraud_details?.score_breakdown || {}
  const criticalCount = reasons.filter(r => r.severity === 'CRITICAL').length
  const highCount     = reasons.filter(r => r.severity === 'HIGH').length

  // Only show click hint if we have explanation data
  const hasExplanations = (data.score_explanations?.length || 0) > 0

  return (
    <>
      <div
        className="card h-full"
        style={{
          padding: '24px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', minHeight: '260px',
          boxShadow: `inset 0 0 100px -50px ${risk.color}40, 0 10px 30px -10px ${risk.color}20`,
        }}
      >
        <p style={{
          fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.7rem',
          letterSpacing: '0.12em', color: 'var(--text-muted)',
          marginBottom: '20px', textTransform: 'uppercase',
        }}>
          Fraud Risk Score
        </p>

        {/* FIX 2: SVG Ring — clickable to open Score Explainer */}
        <div
          onClick={() => hasExplanations && setModalOpen(true)}
          title={hasExplanations ? 'Click to see score breakdown' : undefined}
          style={{
            position: 'relative', width: '140px', height: '140px',
            cursor: hasExplanations ? 'pointer' : 'default',
          }}
        >
          <svg
            width="140" height="140" viewBox="0 0 140 140"
            style={{ transform: 'rotate(-90deg)', transition: 'filter 0.2s' }}
          >
            {/* Track */}
            <circle cx="70" cy="70" r="54" fill="none" stroke="var(--border)" strokeWidth="10" />
            {/* Score ring */}
            <circle
              cx="70" cy="70" r="54"
              fill="none"
              stroke={risk.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={animated ? offset : circumference}
              style={{
                transition: 'stroke-dashoffset 1.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                filter: `drop-shadow(0 0 8px ${risk.color}66)`,
              }}
            />
          </svg>

          {/* Center text */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'Poppins', fontWeight: 800, fontSize: '2.2rem',
              lineHeight: 1, color: risk.color,
            }}>
              {score}
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono', fontSize: '0.6rem',
              color: 'var(--text-muted)', marginTop: '2px',
            }}>
              /100
            </span>
            {/* FIX 2: "tap to explain" hint */}
            {hasExplanations && (
              <span style={{
                fontFamily: 'JetBrains Mono', fontSize: '0.52rem',
                color: 'var(--text-muted)', marginTop: '4px',
                opacity: 0.7, letterSpacing: '0.04em',
              }}>
                tap to explain
              </span>
            )}
          </div>
        </div>

        {/* Risk badge */}
        <div style={{
          marginTop: '16px',
          background: risk.bg, border: `1px solid ${risk.border}`,
          borderRadius: '6px', padding: '5px 14px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div
            className="pulse-dot"
            style={{ width: '6px', height: '6px', borderRadius: '50%', background: risk.color }}
          />
          <span style={{
            fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: '0.72rem',
            letterSpacing: '0.08em', color: risk.color,
          }}>
            {risk.label}
          </span>
        </div>

        <p style={{
          color: 'var(--text-muted)', fontSize: '0.72rem',
          marginTop: '10px', fontFamily: 'JetBrains Mono',
        }}>
          {data.company_name.toUpperCase()}
        </p>

        {/* FIX 1: Data warning banner */}
        {data.data_warning && (
          <div style={{
            marginTop: '12px',
            background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: '6px', padding: '6px 10px',
            display: 'flex', alignItems: 'flex-start', gap: '6px', maxWidth: '100%',
          }}>
            <span style={{ color: '#eab308', fontSize: '0.65rem', flexShrink: 0, marginTop: '1px' }}>⚠</span>
            <span style={{
              color: '#eab308', fontSize: '0.62rem',
              fontFamily: 'JetBrains Mono', lineHeight: 1.4,
            }}>
              {data.data_warning}
            </span>
          </div>
        )}

        {/* Mini flag summary */}
        {reasons.length > 0 && (
          <div style={{ marginTop: '14px', width: '100%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ height: '1px', background: 'var(--border)', marginBottom: '6px' }} />

            {/* Count pills */}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {criticalCount > 0 && (
                <span style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  color: '#ef4444', fontSize: '0.6rem', padding: '2px 8px',
                  borderRadius: '12px', fontFamily: 'JetBrains Mono', fontWeight: 600,
                }}>
                  {criticalCount} CRITICAL
                </span>
              )}
              {highCount > 0 && (
                <span style={{
                  background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
                  color: '#f97316', fontSize: '0.6rem', padding: '2px 8px',
                  borderRadius: '12px', fontFamily: 'JetBrains Mono', fontWeight: 600,
                }}>
                  {highCount} HIGH
                </span>
              )}
              {reasons.length - criticalCount - highCount > 0 && (
                <span style={{
                  background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)',
                  color: '#eab308', fontSize: '0.6rem', padding: '2px 8px',
                  borderRadius: '12px', fontFamily: 'JetBrains Mono',
                }}>
                  {reasons.length - criticalCount - highCount} OTHER
                </span>
              )}
            </div>

            {/* Top category */}
            {Object.keys(breakdown).length > 0 && (
              <p style={{
                color: 'var(--text-muted)', fontSize: '0.6rem',
                fontFamily: 'JetBrains Mono', textAlign: 'center', marginTop: '4px',
              }}>
                Top risk:{' '}
                <span style={{ color: risk.color }}>
                  {Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0]}
                </span>
              </p>
            )}

            {/* FIX 2: View full breakdown button */}
            {hasExplanations && (
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  marginTop: '6px', background: 'rgba(99,102,241,0.07)',
                  border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px',
                  color: '#6366F1', fontFamily: 'JetBrains Mono', fontSize: '0.62rem',
                  fontWeight: 600, padding: '5px 12px', cursor: 'pointer',
                  letterSpacing: '0.04em', width: '100%', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.13)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.07)' }}
              >
                📊 View Score Breakdown
              </button>
            )}
          </div>
        )}
      </div>

      {/* FIX 2: Score Explainer Modal */}
      {modalOpen && (
        <ScoreExplainerModal data={data} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
