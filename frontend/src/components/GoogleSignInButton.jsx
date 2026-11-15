import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { googleIdTokenAuthApi } from '../utils/api'

/**
 * GoogleSignInButton
 *
 * Production Google Authentication component utilizing Google Identity Services (GIS).
 *
 * Flow:
 * 1. Initializes Google Identity Services with VITE_GOOGLE_CLIENT_ID.
 * 2. Renders Google's official, cryptographically secure Sign-In button iframe.
 * 3. On user authentication, receives the signed Google ID token (credential).
 * 4. Sends ID token to FastAPI backend (/auth/google) for cryptographic verification
 *    (signature, audience, issuer, expiration, email_verified).
 * 5. Logs in user and sets application JWT session in AuthContext, then redirects to dashboard.
 *
 * When VITE_GOOGLE_CLIENT_ID is not configured:
 * Renders a clean disabled button with a clear configuration indicator — no fake/demo bypass.
 */
export default function GoogleSignInButton({
  label = 'Continue with Google',
  textType = 'continue_with', // 'continue_with' | 'signin_with' | 'signup_with'
  disabled = false,
  onError,
}) {
  const [loading, setLoading] = useState(false)
  const [internalError, setInternalError] = useState('')
  const [gisReady, setGisReady] = useState(false)

  const buttonRef = useRef(null)
  const navigate = useNavigate()
  const { loginUser } = useAuth()

  const rawClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  const isPlaceholder =
    !rawClientId ||
    /^(your[-_]|<|\[|placeholder|xxx)/i.test(rawClientId) ||
    /client[-_]?id/i.test(rawClientId) ||
    rawClientId.length < 20
  const isConfigured = !isPlaceholder
  const clientId = isConfigured ? rawClientId : ''

  const notifyError = useCallback((message) => {
    setInternalError(message)
    if (typeof onError === 'function') {
      onError(message)
    }
  }, [onError])

  // Handle verified credential returned by Google Identity Services
  const handleCredentialResponse = useCallback(async (response) => {
    if (!response || !response.credential) {
      notifyError('Google sign-in was cancelled or returned an invalid credential.')
      return
    }

    setLoading(true)
    setInternalError('')

    try {
      // Send Google ID token to FastAPI for server-side verification and application JWT issuance
      const data = await googleIdTokenAuthApi(response.credential)
      loginUser(data.access_token, data.user)
      navigate('/', { replace: true })
    } catch (err) {
      notifyError(err.message || 'Google authentication failed.')
    } finally {
      setLoading(false)
    }
  }, [loginUser, navigate, notifyError])

  // Initialize GIS and render official button when client ID and GIS SDK are available
  useEffect(() => {
    if (!isConfigured) return

    let checkInterval = null
    let attempts = 0
    const maxAttempts = 30 // ~6 seconds

    // Ensure GIS script is present in the document if not already loaded
    if (!window.google?.accounts?.id && !document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    function initGis() {
      if (window.google?.accounts?.id && buttonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          })

          // Calculate available width for the Google button (clamped to GIS allowed 200–400px)
          const parentWidth = buttonRef.current.parentElement?.offsetWidth || buttonRef.current.offsetWidth || 356
          const buttonWidth = Math.max(200, Math.min(400, parentWidth))

          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'filled_black',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: textType,
            logo_alignment: 'left',
            width: buttonWidth,
          })

          setGisReady(true)
          if (checkInterval) clearInterval(checkInterval)
        } catch (err) {
          console.warn('[GoogleSignInButton] Failed to initialize Google button:', err)
        }
      }
    }

    if (window.google?.accounts?.id) {
      initGis()
    } else {
      checkInterval = setInterval(() => {
        attempts++
        if (window.google?.accounts?.id) {
          initGis()
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
        }
      }, 200)
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [isConfigured, clientId, textType, handleCredentialResponse])

  // Trigger Google One Tap / Account chooser if clicked before renderButton iframe completes
  const handleFallbackClick = () => {
    if (!isConfigured) {
      notifyError('Google Sign-In is not configured. Add VITE_GOOGLE_CLIENT_ID to frontend/.env and restart Vite.')
      return
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          notifyError('Google Sign-In prompt was closed. Please try again.')
        }
      })
    } else {
      notifyError('Google Identity Services is still loading. Please check your internet connection or ad-blockers.')
    }
  }

  return (
    <div className="google-auth-wrapper" style={{ width: '100%', marginBottom: '12px' }}>
      {/* Loading state while backend is verifying token */}
      {loading ? (
        <div
          className="auth-google-btn"
          style={{
            cursor: 'wait',
            opacity: 0.85,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <div className="auth-spinner-google" />
          <span style={{ fontSize: '0.875rem' }}>Verifying Google account…</span>
        </div>
      ) : isConfigured ? (
        <div style={{ position: 'relative', width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center' }}>
          {/* Target container for Google's official rendered button */}
          <div
            ref={buttonRef}
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              minHeight: '44px',
              visibility: gisReady ? 'visible' : 'hidden',
              position: gisReady ? 'static' : 'absolute',
              top: 0,
              left: 0,
            }}
          />

          {/* Standby button while GIS script initializes or if iframe hasn't rendered yet */}
          {!gisReady && (
            <button
              type="button"
              className="auth-google-btn"
              onClick={handleFallbackClick}
              disabled={disabled || loading}
            >
              <GoogleGLogo />
              <span>{label}</span>
            </button>
          )}
        </div>
      ) : (
        /* Unconfigured State: clear, truthful indicator with zero demo/bypass behavior */
        <div>
          <button
            type="button"
            className="auth-google-btn"
            onClick={handleFallbackClick}
            disabled={true}
            style={{
              opacity: 0.55,
              cursor: 'not-allowed',
            }}
          >
            <GoogleGLogo />
            <span>{label}</span>
          </button>
          <div
            style={{
              fontSize: '0.72rem',
              color: '#94a3b8',
              textAlign: 'center',
              marginTop: '6px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Google Sign-In requires <code style={{ color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '1px 4px', borderRadius: '4px' }}>VITE_GOOGLE_CLIENT_ID</code> in <code style={{ color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '1px 4px', borderRadius: '4px' }}>frontend/.env</code>
          </div>
        </div>
      )}

      {/* Inline error notice if parent does not have a banner */}
      {internalError && !onError && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#ef4444',
            fontSize: '0.78rem',
            textAlign: 'center',
          }}
        >
          {internalError}
        </div>
      )}
    </div>
  )
}

function GoogleGLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path
        d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z"
        fill="#4285F4"
      />
      <path
        d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.96409 10.71C3.78409 10.17 3.68182 9.5931 3.68182 9C3.68182 8.4068 3.78409 7.8299 3.96409 7.2899V4.9581H0.957275C0.347727 6.1731 0 7.5477 0 9C0 10.4522 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795C10.3214 3.5795 11.5077 4.0340 12.4405 4.9259L15.0218 2.3445C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9581L3.96409 7.2899C4.67182 5.1627 6.65591 3.5795 9 3.5795Z"
        fill="#EA4335"
      />
    </svg>
  )
}
