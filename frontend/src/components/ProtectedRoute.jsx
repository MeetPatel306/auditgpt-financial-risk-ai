import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

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

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
