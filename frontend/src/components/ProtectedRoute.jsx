import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, token, loading, authError, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen grid-bg" style={{ background: 'var(--bg-primary)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="auth-spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{
              color: 'var(--text-secondary)',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.8rem',
              letterSpacing: '0.1em',
            }}>AUTHENTICATING...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user && token && authError) {
    return (
      <div className="min-h-screen grid-bg" style={{ background: 'var(--bg-primary)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
            <p style={{
              color: 'var(--text-primary)',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '1.05rem',
              marginBottom: 8,
            }}>Unable to restore your session</p>
            <p style={{
              color: 'var(--text-secondary)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.9rem',
            }}>{authError}</p>
            <button
              onClick={logout}
              className="auth-submit"
              style={{ marginTop: 20, display: 'inline-block', width: 'auto', padding: '10px 24px' }}
            >
              Sign in with another account
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
