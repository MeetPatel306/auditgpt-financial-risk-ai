import { useState, useEffect, useRef } from 'react'
import { getRiskConfig } from '../utils/format'
import { generateReportStream } from '../utils/api'

const MODEL_CONFIG = {
  'gpt-4o-mini': { label: 'GPT-4o mini', color: '#22c55e', icon: '✦', desc: 'OpenAI' },
  local:         { label: 'AuditGPT-Local', color: '#6366F1', icon: '⬡', desc: 'On-device' },
}

const LEVEL_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  moderate: '#eab308',
  low:      '#22c55e',
}

export default function AISummary({ data }) {
  const [phase,     setPhase]     = useState('idle')
  const [displayed, setDisplayed] = useState('')
  const [model,     setModel]     = useState(null)
  const [errMsg,    setErrMsg]    = useState('')
  const [showMeth,  setShowMeth]  = useState(false)
  const textRef = useRef('')

  const risk      = getRiskConfig(data.risk_level)
  const modelCfg  = MODEL_CONFIG[model] || MODEL_CONFIG.local

  // FIX 2: score_explanations from backend
  const explanations = data.score_explanations || []

  useEffect(() => {
    textRef.current = ''
    setDisplayed('')
    setModel(null)
    setPhase('idle')
    setErrMsg('')
    setShowMeth(false)
  }, [data.nse_symbol])

  async function handleGenerate() {
    textRef.current = ''
    setDisplayed('')
    setPhase('loading')
    setErrMsg('')

    try {
      setPhase('streaming')
      const usedModel = await generateReportStream(data, (chunk) => {
        textRef.current += chunk
        setDisplayed(textRef.current)
      })
      setModel(usedModel)
      setPhase('done')
    } catch (err) {
      setErrMsg(err.message || 'Report generation failed')
      setPhase('error')
    }
  }

  const paragraphs = displayed.split('\n\n').filter(Boolean)

  return (
    <div className="card" style={{ padding: '24px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(0,100,200,0.2))',
          border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L10 6H15L11 9.5L12.5 15L8 12L3.5 15L5 9.5L1 6H6L8 1Z"
              fill="var(--accent-cyan)" opacity="0.9"/>
          </svg>
        </div>

        <div>
          <h3 style={{
            fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.8rem',
            letterSpacing: '0.1em', color: 'var(--text-muted)',
            textTransform: 'uppercase', margin: 0,
          }}>
            AI Analysis Report
          </h3>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {model && (
            <span style={{
              background: `${modelCfg.color}12`, border: `1px solid ${modelCfg.color}30`,
              color: modelCfg.color, fontSize: '0.62rem', padding: '2px 8px',
              borderRadius: '12px', fontFamily: 'JetBrains Mono', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <span>{modelCfg.icon}</span> {modelCfg.label}
            </span>
          )}
          <span className="risk-badge" style={{ background: risk.bg, border: `1px solid ${risk.border}`, color: risk.color }}>
            {risk.label}
          </span>
        </div>
      </div>

      {/* ── Idle state ── */}
      {phase === 'idle' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '32px 20px', gap: '16px',
          background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--border)',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L13.5 8.5H20L14.5 12.5L16.5 19.5L11 15.5L5.5 19.5L7.5 12.5L2 8.5H8.5L11 2Z"
                stroke="#6366F1" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500, margin: '0 0 6px' }}>
              Generate AI Financial Report
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', margin: 0 }}>
              Analyzes revenue trends, debt patterns, cash flow quality &amp; peer comparison
            </p>
          </div>
          <button onClick={handleGenerate} className="ai-generate-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M7 1L8.5 5.5H13L9.5 8L10.5 12.5L7 10L3.5 12.5L4.5 8L1 5.5H5.5L7 1Z" fill="currentColor"/>
            </svg>
            Generate AI Report
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '12px' }}>
          <div className="ai-spinner" />
          <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.78rem' }}>
            Generating analysis...
          </span>
        </div>
      )}

      {/* ── Streaming / Done ── */}
      {(phase === 'streaming' || phase === 'done') && (
        <div>
          <div style={{
            background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '18px 20px',
            border: '1px solid var(--border)', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: '3px', height: '50px',
              background: `linear-gradient(to bottom, ${risk.color}, transparent)`,
              borderRadius: '8px 0 0 0',
            }} />
            <div style={{ paddingLeft: '8px' }}>
              {paragraphs.map((para, i) => (
                <p key={i} style={{
                  color: 'var(--text-primary)', fontSize: '0.92rem',
                  lineHeight: 1.72, margin: i < paragraphs.length - 1 ? '0 0 14px' : '0',
                  fontWeight: 300,
                }}>
                  {para}
                  {phase === 'streaming' && i === paragraphs.length - 1 && (
                    <span style={{
                      display: 'inline-block', width: '2px', height: '1em',
                      background: 'var(--accent-cyan)', marginLeft: '2px',
                      verticalAlign: 'text-bottom',
                      animation: 'blink 0.7s step-end infinite',
                    }} />
                  )}
                </p>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: '10px', flexWrap: 'wrap', gap: '8px',
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'JetBrains Mono', margin: 0 }}>
              ANALYZED: {new Date(data.analyzed_at).toLocaleString()}
              {model && ` · MODEL: ${(MODEL_CONFIG[model]?.label || model).toUpperCase()}`}
            </p>
            {phase === 'done' && (
              <button
                onClick={handleGenerate}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: '0.65rem',
                  padding: '3px 10px', borderRadius: '6px',
                  cursor: 'pointer', fontFamily: 'JetBrains Mono', transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.target.style.borderColor = '#6366F150'; e.target.style.color = '#6366F1' }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)' }}
              >
                ↻ Regenerate
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {phase === 'error' && (
        <div style={{
          background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '8px', padding: '16px 20px',
        }}>
          <p style={{ color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', margin: '0 0 10px' }}>
            ⚠ {errMsg}
          </p>
          <button onClick={handleGenerate} className="ai-generate-btn" style={{ fontSize: '0.72rem', padding: '6px 14px' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── FIX 2: How Score is Calculated — methodology section ── */}
      {explanations.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '14px' }} />

          {/* Toggle header */}
          <button
            onClick={() => setShowMeth(o => !o)}
            style={{
              width: '100%', background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', padding: '0', marginBottom: showMeth ? '14px' : '0',
            }}
          >
            <span style={{
              fontFamily: 'JetBrains Mono', fontSize: '0.68rem', fontWeight: 600,
              color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              📐 How this score is calculated
            </span>
            <span style={{
              color: 'var(--text-muted)', fontSize: '0.65rem',
              fontFamily: 'JetBrains Mono', transition: 'transform 0.2s',
              transform: showMeth ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              ▾
            </span>
          </button>

          {/* Methodology table */}
          {showMeth && (
            <div style={{ animation: 'expandDown 0.18s ease' }}>
              <div style={{
                background: 'rgba(0,0,0,0.15)', borderRadius: '8px',
                border: '1px solid var(--border)', overflow: 'hidden',
              }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 80px',
                  gap: '0',
                  background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid var(--border)',
                  padding: '8px 14px',
                }}>
                  {['Dimension', 'Score', 'Level'].map(h => (
                    <span key={h} style={{
                      color: 'var(--text-muted)', fontSize: '0.6rem',
                      fontFamily: 'JetBrains Mono', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {explanations.map((exp, i) => {
                  const levelColor = LEVEL_COLORS[exp.level] || '#eab308'
                  const isLast     = i === explanations.length - 1
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 80px 80px',
                        padding: '10px 14px', alignItems: 'center',
                        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Dimension name + explanation */}
                      <div>
                        <p style={{
                          color: 'var(--text-primary)', fontSize: '0.75rem',
                          fontFamily: 'JetBrains Mono', margin: '0 0 3px', fontWeight: 500,
                        }}>
                          {exp.category}
                        </p>
                        <p style={{
                          color: 'var(--text-muted)', fontSize: '0.62rem',
                          margin: 0, lineHeight: 1.45,
                        }}>
                          {exp.explanation}
                        </p>
                      </div>

                      {/* Score with mini bar */}
                      <div style={{ paddingRight: '8px' }}>
                        <span style={{
                          color: levelColor, fontFamily: 'JetBrains Mono',
                          fontSize: '0.8rem', fontWeight: 700,
                        }}>
                          {exp.score}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', fontFamily: 'JetBrains Mono' }}>
                          /95
                        </span>
                        <div style={{
                          height: '3px', background: 'rgba(255,255,255,0.06)',
                          borderRadius: '3px', overflow: 'hidden', marginTop: '4px',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.round((exp.score / 95) * 100)}%`,
                            background: levelColor, borderRadius: '3px',
                          }} />
                        </div>
                      </div>

                      {/* Level badge */}
                      <div>
                        <span style={{
                          background: `${levelColor}15`, color: levelColor,
                          border: `1px solid ${levelColor}30`,
                          fontSize: '0.55rem', fontFamily: 'JetBrains Mono',
                          fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                        }}>
                          {exp.level}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p style={{
                color: 'var(--text-muted)', fontSize: '0.62rem',
                fontFamily: 'JetBrains Mono', margin: '8px 0 0',
                lineHeight: 1.5,
              }}>
                Each dimension scores 0–95 based on detected anomalies in financial data. Points from all dimensions are summed to produce the final fraud score (0–100).
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes blink       { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin        { to { transform: rotate(360deg) } }
        @keyframes expandDown  { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }

        .ai-generate-btn {
          display: flex; align-items: center; gap: 7px;
          background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(0,100,200,0.12));
          border: 1px solid rgba(99,102,241,0.3);
          color: #6366F1; padding: 9px 22px; border-radius: 8px;
          cursor: pointer; font-family: 'JetBrains Mono', monospace;
          font-size: 0.78rem; font-weight: 500; letter-spacing: 0.04em;
          transition: all 0.2s ease;
        }
        .ai-generate-btn:hover {
          background: rgba(99,102,241,0.18);
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 16px rgba(99,102,241,0.12);
          transform: translateY(-1px);
        }
        .ai-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(99,102,241,0.15);
          border-top-color: #6366F1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}