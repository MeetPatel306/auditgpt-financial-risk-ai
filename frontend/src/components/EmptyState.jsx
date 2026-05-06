export default function EmptyState() {
  const features = [
    { icon: '🎯', label: 'Fraud Score',       desc: 'AI-powered 0–100 risk rating'     },
    { icon: '🤖', label: 'AI Summary',         desc: 'Natural language analysis'        },
    { icon: '📈', label: 'Financial Charts',   desc: '10-year Yahoo Finance data'       },
    { icon: '🚩', label: 'Red Flags',          desc: 'Anomaly & risk signal detection'  },
    { icon: '⚖️', label: 'Peer Comparison',    desc: 'Sector benchmark analysis'        },
    { icon: '📊', label: 'Auditor Sentiment',  desc: 'NLP on financial disclosures'     },
  ]

  const quickSymbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'TATAMOTORS', 'COALINDIA', 'WIPRO']

  return (
    <div className="mt-10 flex flex-col items-center" style={{ paddingBottom: 40 }}>
      {/* Hero icon */}
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(0,100,180,0.08))',
        border: '1px solid rgba(99,102,241,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2rem', marginBottom: 20,
        boxShadow: '0 0 40px rgba(99,102,241,0.08)',
      }}>
        🛡️
      </div>

      <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-primary)', margin: '0 0 8px', textAlign: 'center' }}>
        Ready to Detect Fraud
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', textAlign: 'center', maxWidth: 440, margin: '0 0 28px', lineHeight: 1.6 }}>
        Enter any NSE-listed company name or symbol above and click <strong style={{ color: '#6366F1' }}>Analyze</strong> to run AI-powered financial fraud detection.
      </p>

      {/* Quick symbols */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'JetBrains Mono', lineHeight: '28px' }}>Try:</span>
        {quickSymbols.map(s => (
          <span key={s} style={{
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
            color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: 6,
            fontFamily: 'JetBrains Mono', fontSize: '0.72rem', cursor: 'default',
          }}>{s}</span>
        ))}
      </div>

      {/* Feature grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 620, width: '100%' }}>
        {features.map((f, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', textAlign: 'center', transition: 'transform 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>{f.icon}</div>
            <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)', margin: '0 0 3px' }}>{f.label}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontFamily: 'JetBrains Mono', margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* NSE data badge */}
      <div style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['NSE Listed', 'Yahoo Finance', 'Real-Time Data', 'AI Powered', 'PDF Export'].map(tag => (
          <span key={tag} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', padding: '3px 10px', borderRadius: 20,
            fontSize: '0.62rem', fontFamily: 'JetBrains Mono',
          }}>{tag}</span>
        ))}
      </div>
    </div>
  )
}
