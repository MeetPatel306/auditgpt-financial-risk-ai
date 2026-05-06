import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginUserApi } from '../utils/api'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await loginUserApi(email, password)
      loginUser(data.access_token, data.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid-bg auth-page" style={{ background: 'var(--bg-primary)' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo fade-in-up">
          <div style={{
            width: '48px', height: '48px',
            background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(99,102,241,0.3)',
            margin: '0 auto 16px',
          }}>
            <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L3 6V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V6L10 2Z"
                stroke="white" strokeWidth="1.5" fill="none"/>
              <path d="M7 10L9 12L13 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.75rem',
            letterSpacing: '-0.02em', color: 'var(--text-primary)', textAlign: 'center',
          }}>
            Audit<span style={{ color: 'var(--accent-cyan)' }}>GPT</span>
          </h1>
          <p style={{
            color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center',
            marginTop: '4px',
          }}>Sign in to your account</p>
        </div>

        {/* Form card */}
        <div className="auth-card fade-in-up fade-in-up-delay-1">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="auth-error">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#ef4444" strokeWidth="1.5"/>
                  <path d="M8 5V9" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.75" fill="#ef4444"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Email</label>
              <div className="auth-input-wrapper">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M2 6L9 10L16 6" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrapper">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="3" y="8" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M6 8V5.5C6 3.567 7.343 2 9 2C10.657 2 12 3.567 12 5.5V8" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="9" cy="12" r="1" fill="currentColor"/>
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2 9C2 9 5 4 9 4C13 4 16 9 16 9C16 9 13 14 9 14C5 14 2 9 2 9Z" stroke="currentColor" strokeWidth="1.3"/>
                      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M3 15L15 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2 9C2 9 5 4 9 4C13 4 16 9 16 9C16 9 13 14 9 14C5 14 2 9 2 9Z" stroke="currentColor" strokeWidth="1.3"/>
                      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <div className="auth-spinner-small" />
                  SIGNING IN...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 2H4C2.895 2 2 2.895 2 4V12C2 13.105 2.895 14 4 14H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M11 8H5M11 8L8.5 5.5M11 8L8.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  SIGN IN
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">Create account</Link>
          </p>
        </div>

        {/* Footer */}
        <p className="auth-footer fade-in-up fade-in-up-delay-2">
          AI-Powered Financial Fraud Detection & Risk Intelligence
        </p>
      </div>
    </div>
  )
}
