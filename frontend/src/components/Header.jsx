import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation, Link } from 'react-router-dom'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const isPortfolio = location.pathname === '/portfolio'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="mb-10">
      <div className="flex items-center gap-3 mb-2">
        {/* Logo mark */}
        <div style={{
          width: '36px', height: '36px',
          background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(99,102,241,0.3)',
          flexShrink: 0
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L3 6V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V6L10 2Z" 
              stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M7 10L9 12L13 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h1 style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 800,
            fontSize: '1.5rem',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            lineHeight: 1,
          }}>
            Audit<span style={{ color: 'var(--accent-cyan)' }}>GPT</span>
          </h1>
        </div>
        <div className="ml-2">
          <span className="risk-badge" style={{
            background: 'rgba(99,102,241,0.08)',
            color: 'var(--accent-cyan)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>BETA</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: '4px', marginRight: '16px' }}>
          {[
            { to: '/',          label: '⚡ Analyze',  active: !isPortfolio },
            { to: '/portfolio', label: '📊 Portfolio', active: isPortfolio  },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                padding: '6px 14px', borderRadius: '7px', textDecoration: 'none',
                fontFamily: 'JetBrains Mono', fontSize: '0.7rem', fontWeight: 600,
                letterSpacing: '0.03em',
                background: item.active ? 'rgba(99,102,241,0.1)' : 'transparent',
                color:      item.active ? '#6366F1' : 'var(--text-muted)',
                border: `1px solid ${item.active ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User info + Logout */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="header-user-badge">
              <div className="header-avatar">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <span className="header-user-name">{user.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="header-logout-btn"
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H4C2.895 2 2 2.895 2 4V12C2 13.105 2.895 14 4 14H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M11 8H5M11 8L8.5 5.5M11 8L8.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>LOGOUT</span>
            </button>
          </div>
        )}
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginLeft: '48px' }}>
        AI-Powered Financial Fraud Detection & Risk Intelligence
      </p>
    </header>
  )
}
