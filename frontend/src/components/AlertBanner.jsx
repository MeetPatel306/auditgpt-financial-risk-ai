import { useState, useEffect, useRef } from 'react'
import { getAlertEmailConfig, sendAlertEmail } from '../utils/api'

/**
 * RISK_CONFIG covers internal fraud_score risk levels AND external
 * regulatory alert types from BSE / SEBI scrapers.
 */
const RISK_CONFIG = {
  CRITICAL:     { color: '#ef4444', glow: 'rgba(239,68,68,0.25)', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.35)', label: 'CRITICAL RISK' },
  HIGH:         { color: '#f97316', glow: 'rgba(249,115,22,0.22)', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.32)', label: 'HIGH RISK'     },
  BSE_ALERT:    { color: '#0ea5e9', glow: 'rgba(14,165,233,0.20)', bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.30)', label: 'BSE ALERT'     },
  SEBI_PENALTY: { color: '#a855f7', glow: 'rgba(168,85,247,0.22)', bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.32)', label: 'SEBI PENALTY'  },
}

export default function AlertBanner({ data }) {
  const { fraud_score, risk_level, company_name, nse_symbol, fraud_details, regulatory_alerts } = data
  const reasons = fraud_details?.reasons?.map(r => r.reason) || []

  const cfg = RISK_CONFIG[risk_level] || RISK_CONFIG.HIGH

  const [visible,      setVisible]      = useState(false)
  const [dismissed,    setDismissed]    = useState(false)
  const [emailSection, setEmailSection] = useState(false)  // show email sub-form
  const [email,        setEmail]        = useState('')
  const [sending,      setSending]      = useState(false)
  const [emailResult,  setEmailResult]  = useState(null)   // { sent, message }
  const [emailConfig,  setEmailConfig]  = useState({ configured: false, has_default_recipient: false, missing: [] })
  const timerRef = useRef(null)

  // Slide-in after a short delay so it feels like it "arrives"
  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(timerRef.current)
  }, [fraud_score, company_name])

  useEffect(() => {
    let isMounted = true
    async function loadConfig() {
      try {
        const cfg = await getAlertEmailConfig()
        if (isMounted) setEmailConfig(cfg)
      } catch {
        if (isMounted) {
          setEmailConfig({ configured: false, has_default_recipient: false, missing: ['Unable to check server config'] })
        }
      }
    }
    loadConfig()
    return () => { isMounted = false }
  }, [])

  async function handleSendEmail(e) {
    e.preventDefault()
    setSending(true)
    setEmailResult(null)
    try {
      const json = await sendAlertEmail({
        company_name,
        nse_symbol,
        fraud_score,
        risk_level,
        reasons,
        regulatory_alerts: regulatory_alerts || [],
        recipient_email: email || undefined,
      })
      if (json.email_sent) {
        setEmailResult({ sent: true, message: `Alert sent to ${json.recipient}` })
      } else {
        setEmailResult({ sent: false, message: json.reason || 'Email not sent.', kind: 'config' })
      }
    } catch {
      setEmailResult({ sent: false, message: 'Network error — could not reach backend.' })
    } finally {
      setSending(false)
    }
  }

  // Show if either fraud score is high OR there are regulatory alerts
  const hasReg = Array.isArray(regulatory_alerts) && regulatory_alerts.length > 0
  if (dismissed || (fraud_score <= 70 && !hasReg)) return null

  return (
    <>
      {/* ─── Banner ─────────────────────────────────────────────────── */}
      <div
        style={{
          // slide-in animation
          transform:  visible ? 'translateY(0)'    : 'translateY(-16px)',
          opacity:    visible ? 1                  : 0,
          transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',

          position: 'relative',
          borderRadius: '12px',
          border:   `1px solid ${cfg.border}`,
          background: cfg.bg,
          boxShadow: `0 0 32px ${cfg.glow}, 0 0 0 1px ${cfg.border}`,
          overflow: 'hidden',
          marginBottom: '0',
        }}
        role="alert"
        aria-live="assertive"
      >
        {/* Pulsing left accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
          background: cfg.color,
          animation: 'pulse-bar 2s ease-in-out infinite',
        }} />

        {/* Top stripe scan-line effect */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${cfg.color}04 3px, ${cfg.color}04 4px)`,
        }} />

        <div style={{ padding: '16px 20px 16px 26px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>

            {/* Animated warning icon */}
            <div style={{
              flexShrink: 0, width: '36px', height: '36px',
              borderRadius: '9px',
              background: `${cfg.color}18`, border: `1px solid ${cfg.color}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'alert-pulse 2.2s ease-in-out infinite',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L16.5 15.5H1.5L9 2Z" stroke={cfg.color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                <path d="M9 7.5v4" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="9" cy="13.5" r="0.8" fill={cfg.color}/>
              </svg>
            </div>

            {/* Main content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{
                  color: cfg.color, fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
                  fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>
                  ⚑ High Risk Company Detected
                </span>
                <span style={{
                  background: `${cfg.color}20`, color: cfg.color,
                  border: `1px solid ${cfg.color}35`,
                  padding: '2px 10px', borderRadius: '20px',
                  fontFamily: 'JetBrains Mono', fontSize: '0.6rem', fontWeight: 700,
                }}>
                  {cfg.label}
                </span>
                <span style={{
                  background: 'rgba(0,0,0,0.3)', color: cfg.color,
                  border: `1px solid ${cfg.color}25`,
                  padding: '2px 10px', borderRadius: '20px',
                  fontFamily: 'JetBrains Mono', fontSize: '0.6rem', fontWeight: 700,
                }}>
                  Score: {fraud_score}/100
                </span>
              </div>

              <p style={{
                color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', margin: '0 0 10px',
              }}>
                <strong style={{ color: 'white' }}>{company_name}</strong> ({nse_symbol}) has a fraud risk score of{' '}
                <strong style={{ color: cfg.color }}>{fraud_score}</strong> — significantly above the safe threshold of 70.
                Immediate review is recommended before making any financial decisions.
              </p>

              {/* Top reasons pills */}
              {reasons.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {reasons.slice(0, 3).map((r, i) => (
                    <span key={i} style={{
                      background: 'rgba(0,0,0,0.3)', border: `1px solid ${cfg.color}20`,
                      color: 'rgba(255,255,255,0.55)', fontSize: '0.65rem',
                      padding: '3px 10px', borderRadius: '4px', fontFamily: 'JetBrains Mono',
                    }}>
                      {r}
                    </span>
                  ))}
                  {reasons.length > 3 && (
                    <span style={{ color: cfg.color, fontSize: '0.65rem', fontFamily: 'JetBrains Mono', lineHeight: '22px' }}>
                      +{reasons.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* ─── Regulatory Alerts (BSE / SEBI) ───────────────── */}
              {hasReg && (
                <div style={{ marginBottom: '12px' }}>
                  <p style={{
                    color: 'rgba(255,255,255,0.6)', fontFamily: 'JetBrains Mono',
                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', margin: '0 0 6px',
                  }}>
                    Regulatory signals
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {regulatory_alerts.slice(0, 4).map((a, i) => {
                      const acfg = RISK_CONFIG[a.type] || RISK_CONFIG.BSE_ALERT
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          background: 'rgba(0,0,0,0.25)',
                          border: `1px solid ${acfg.color}25`,
                          borderLeft: `3px solid ${acfg.color}`,
                          borderRadius: 6, padding: '6px 10px',
                        }}>
                          <span style={{
                            background: `${acfg.color}20`, color: acfg.color,
                            border: `1px solid ${acfg.color}35`,
                            padding: '1px 7px', borderRadius: 4,
                            fontFamily: 'JetBrains Mono', fontSize: '0.55rem',
                            fontWeight: 700, letterSpacing: '0.08em',
                            flexShrink: 0,
                          }}>
                            {acfg.label}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem',
                              margin: 0, lineHeight: 1.4,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {a.title || a.headline || 'Regulatory action'}
                            </p>
                            <p style={{
                              color: 'var(--text-muted)', fontSize: '0.6rem',
                              fontFamily: 'JetBrains Mono', margin: '2px 0 0',
                            }}>
                              {a.date || ''}{a.source ? ` · ${a.source}` : ''}
                              {a.url && (
                                <>
                                  {' · '}
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: acfg.color, textDecoration: 'none' }}
                                  >
                                    Open ↗
                                  </a>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="alert-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setEmailSection(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`,
                    color: cfg.color, padding: '6px 14px', borderRadius: '7px',
                    fontFamily: 'JetBrains Mono', fontSize: '0.68rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.03em',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `${cfg.color}25`}
                  onMouseLeave={e => e.currentTarget.style.background = `${cfg.color}15`}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="2.5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                    <path d="M1 4l5 3.5L11 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {emailSection ? 'Hide Email Form' : 'Send Email Alert'}
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: '7px',
                    fontFamily: 'JetBrains Mono', fontSize: '0.68rem', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Close X */}
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss alert"
              style={{
                flexShrink: 0, background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '2px',
                fontSize: '1rem', lineHeight: 1, transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = cfg.color}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
            >×</button>
          </div>

          {/* ─── Email sub-form (collapsible) ──────────────────────── */}
          <div style={{
            maxHeight: emailSection ? '200px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.35s ease',
          }}>
            <div style={{
              marginTop: '14px', paddingTop: '14px',
              borderTop: `1px solid ${cfg.color}20`,
            }}>
              {emailResult ? (
                <div style={{
                  padding: '10px 14px', borderRadius: '7px',
                  background: emailResult.sent
                    ? 'rgba(34,197,94,0.08)'
                    : (emailResult.kind === 'config' ? 'rgba(234,179,8,0.08)' : 'rgba(239,68,68,0.08)'),
                  border: `1px solid ${emailResult.sent
                    ? 'rgba(34,197,94,0.25)'
                    : (emailResult.kind === 'config' ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)')}`,
                }}>
                  <p style={{
                    margin: 0, fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
                    color: emailResult.sent ? '#22c55e' : (emailResult.kind === 'config' ? '#eab308' : '#ef4444'),
                    fontWeight: 600,
                  }}>
                    {emailResult.sent ? '✓ ' : '⚠ '}{emailResult.message}
                  </p>
                  {!emailResult.sent && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                      To enable email alerts, set <code style={{ color: '#6366F1' }}>ALERT_EMAIL_FROM</code>, <code style={{ color: '#6366F1' }}>ALERT_EMAIL_PASSWORD</code>, and <code style={{ color: '#6366F1' }}>ALERT_EMAIL_TO</code> in your backend <code>.env</code>.
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSendEmail} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {!emailConfig.configured && (
                    <div style={{
                      width: '100%',
                      background: 'rgba(234,179,8,0.08)',
                      border: '1px solid rgba(234,179,8,0.25)',
                      borderRadius: '7px',
                      padding: '8px 10px',
                      color: '#eab308',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '0.66rem',
                    }}>
                      Server email setup missing: {emailConfig.missing.join(', ')}.
                    </div>
                  )}
                  <input
                    type="email"
                    placeholder="recipient@email.com (optional — uses ALERT_EMAIL_TO if blank)"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{
                      flex: '1', minWidth: '220px',
                      background: 'rgba(0,0,0,0.3)', border: `1px solid ${cfg.color}25`,
                      borderRadius: '7px', padding: '7px 12px',
                      color: 'var(--text-primary)', fontFamily: 'JetBrains Mono',
                      fontSize: '0.72rem', outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !emailConfig.configured || (!email && !emailConfig.has_default_recipient)}
                    style={{
                      background: cfg.color, color: 'white', border: 'none',
                      padding: '7px 18px', borderRadius: '7px',
                      fontFamily: 'JetBrains Mono', fontSize: '0.72rem', fontWeight: 700,
                      cursor: (sending || !emailConfig.configured || (!email && !emailConfig.has_default_recipient)) ? 'not-allowed' : 'pointer',
                      opacity: (sending || !emailConfig.configured || (!email && !emailConfig.has_default_recipient)) ? 0.6 : 1,
                      transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    {sending && <span style={{ width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
                    {sending ? 'Sending…' : 'Send Alert Email'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── CSS keyframes ──────────────────────────────────────────── */}
      <style>{`
        @keyframes pulse-bar {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes alert-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${cfg.glow}; }
          50%       { box-shadow: 0 0 0 6px transparent; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
