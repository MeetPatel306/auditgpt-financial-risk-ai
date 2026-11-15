import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { googleAuthApi } from '../utils/api'

/**
 * GoogleCallbackPage
 *
 * This page is the redirect target after Google's OAuth consent screen.
 * Google appends `?code=...&state=...` to the URL.
 * We extract the code and POST it to our backend for secure server-side
 * token exchange. The GOOGLE_CLIENT_SECRET never leaves the backend.
 */
export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  const { loginUser } = useAuth()
  const processed = useRef(false)   // prevent double-execution in React StrictMode

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code  = params.get('code')
      const error = params.get('error')

      if (error || !code) {
        const msg = error === 'access_denied'
          ? 'Google sign-in was cancelled.'
          : 'Google authentication failed. Please try again.'
        navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true })
        return
      }

      const redirectUri =
        import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
        `${window.location.origin}/auth/google/callback`

      try {
        const data = await googleAuthApi(code, redirectUri)
        loginUser(data.access_token, data.user)
        navigate('/', { replace: true })
      } catch (err) {
        navigate(`/login?error=${encodeURIComponent(err.message)}`, { replace: true })
      }
    }

    handleCallback()
  }, [navigate, loginUser])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        gap: '20px',
      }}
    >
      {/* AuditGPT logo */}
      <div
        style={{
          width: '52px',
          height: '52px',
          background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 32px rgba(99,102,241,0.35)',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2L3 6V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V6L10 2Z"
            stroke="white" strokeWidth="1.5" fill="none"
          />
          <path d="M7 10L9 12L13 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="auth-spinner" />

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif' }}>
        Completing Google sign-in…
      </p>
    </div>
  )
}
