export default function LoadingState() {
  const steps = [
    { icon: '🔍', label: 'Validating NSE listing'        },
    { icon: '📡', label: 'Fetching Yahoo Finance data'    },
    { icon: '🧠', label: 'Running AI fraud engine'        },
    { icon: '📊', label: 'Computing peer comparison'      },
    { icon: '💬', label: 'Generating auditor sentiment'   },
  ]

  return (
    <div className="mt-10" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 40 }}>
      {/* Spinning ring */}
      <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 28 }}>
        <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="5" />
          <circle
            cx="40" cy="40" r="32" fill="none"
            stroke="url(#spinGrad)" strokeWidth="5"
            strokeLinecap="round" strokeDasharray="200"
            strokeDashoffset="150"
            style={{ animation: 'spin 1.2s linear infinite' }}
          />
          <defs>
            <linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#6366F1" stopOpacity="0"/>
              <stop offset="100%" stopColor="#6366F1"/>
            </linearGradient>
          </defs>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem',
        }}>🛡️</div>
      </div>

      <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', margin: '0 0 6px', textAlign: 'center' }}>
        Analyzing Company…
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '0 0 28px', textAlign: 'center', fontFamily: 'Inter' }}>
        Fetching 10 years of financial data and running fraud detection
      </p>

      {/* Step list with animated dots */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340, width: '100%' }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 14px', borderRadius: 8,
            background: i === 0 ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${i === 0 ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
            animation: `fadeInUp 0.4s ease ${i * 0.1}s both`,
          }}>
            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{s.icon}</span>
            <span style={{
              fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
              color: i === 0 ? '#6366F1' : 'var(--text-muted)',
              fontWeight: i === 0 ? 600 : 400,
            }}>{s.label}</span>
            {i === 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{
                    width: 4, height: 4, borderRadius: '50%', background: '#6366F1',
                    animation: `pulseDot 1.2s ease-in-out ${j * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono', marginTop: 20 }}>
        This may take 15–30 seconds for first load
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
