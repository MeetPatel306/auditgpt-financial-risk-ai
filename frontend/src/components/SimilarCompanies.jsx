export default function SimilarCompanies({ companies, sector, onAnalyze }) {
  if (!companies || companies.length === 0) return null

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(99,102,241,0.2))',
            border: '1px solid rgba(168,85,247,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6" cy="6" r="4" stroke="#a855f7" strokeWidth="1.5" fill="none"/>
              <circle cx="10" cy="10" r="4" stroke="#a855f7" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div>
            <h3 style={{
              fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.8rem',
              letterSpacing: '0.1em', color: 'var(--text-muted)',
              textTransform: 'uppercase', margin: 0,
            }}>
              Similar Companies
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', margin: '2px 0 0', fontFamily: 'Inter' }}>
              Same sector: <span style={{ color: '#a855f7' }}>{sector}</span>
            </p>
          </div>
        </div>
        <span style={{
          background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
          color: '#a855f7', fontSize: '0.68rem', padding: '3px 10px',
          borderRadius: '20px', fontFamily: 'JetBrains Mono',
        }}>
          {companies.length} PEERS
        </span>
      </div>

      <div className="similar-companies-grid">
        {companies.map((company, i) => (
          <button
            key={company.symbol}
            className="similar-company-card"
            onClick={() => onAnalyze(company.name)}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            {/* Company initial avatar */}
            <div className="similar-company-avatar">
              {company.name.charAt(0)}
            </div>

            <div className="similar-company-info">
              <span className="similar-company-symbol">{company.symbol}</span>
              <span className="similar-company-name">{company.name}</span>
            </div>

            {/* Analyze arrow */}
            <div className="similar-company-arrow">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
