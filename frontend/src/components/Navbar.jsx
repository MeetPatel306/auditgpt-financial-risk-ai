import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_LINKS = [
  { to: '/',          label: 'Dashboard', icon: '⚡' },
  { to: '/watchlist',  label: 'Watchlist',  icon: '⭐' },
  { to: '/history',   label: 'History',   icon: '🕒' },
  { to: '/portfolio', label: 'Portfolio',  icon: '📊' },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const location         = useLocation()
  const [open, setOpen]  = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Close menu on route change
  useEffect(() => setOpen(false), [location.pathname])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  // Shadow on scroll
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* ─── Top bar ────────────────────────────────────────────── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: scrolled ? 'rgba(8,12,20,0.97)' : 'rgba(8,12,20,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${scrolled ? 'rgba(30,45,66,0.9)' : 'rgba(30,45,66,0.5)'}`,
          transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.35)' : 'none',
        }}
      >
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '0 16px',
          display: 'flex', alignItems: 'center', height: 58,
          gap: 12,
        }}>

          {/* ── Logo ── */}
          <Link
            to="/"
            aria-label="AuditGPT home"
            style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(99,102,241,0.3)',
            }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L3 6V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V6L10 2Z"
                  stroke="white" strokeWidth="1.5" fill="none"/>
                <path d="M7 10L9 12L13 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.2rem',
              letterSpacing: '-0.02em', color: 'var(--text-primary)',
            }}>
              Audit<span style={{ color: 'var(--accent-cyan)' }}>GPT</span>
            </span>
            <span style={{
              background: 'rgba(99,102,241,0.08)', color: 'var(--accent-cyan)',
              border: '1px solid rgba(99,102,241,0.2)',
              fontSize: '0.55rem', fontFamily: 'JetBrains Mono', fontWeight: 600,
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.1em',
            }}>BETA</span>
          </Link>

          {/* ── Desktop nav links (hidden on mobile) ── */}
          <div className="hidden-mobile" style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 7, textDecoration: 'none',
                    fontFamily: 'JetBrains Mono', fontSize: '0.72rem', fontWeight: 600,
                    letterSpacing: '0.03em', transition: 'all 0.15s',
                    background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                    color:      active ? '#6366F1' : 'var(--text-muted)',
                    border: `1px solid ${active ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
                  }}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>

          {/* ── Spacer ── */}
          <div style={{ flex: 1 }} />

          {/* ── Desktop user info (hidden on mobile) ── */}
          {user && (
            <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '4px 12px 4px 4px', borderRadius: 20,
                background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 700, color: 'white',
                  fontFamily: 'Poppins, sans-serif',
                }}>
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <span style={{
                  color: 'var(--text-secondary)', fontSize: '0.78rem',
                  maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Sign out"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7,
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                  color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono',
                  fontSize: '0.62rem', letterSpacing: '0.08em', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 2H4C2.895 2 2 2.895 2 4V12C2 13.105 2.895 14 4 14H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M11 8H5M11 8L8.5 5.5M11 8L8.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                LOGOUT
              </button>
            </div>
          )}

          {/* ── Hamburger (mobile only) ── */}
          <button
            className="show-mobile"
            onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            style={{
              display: 'none', /* shown via CSS class */
              padding: '8px', borderRadius: 8, border: 'none',
              background: open ? 'rgba(99,102,241,0.08)' : 'transparent',
              color: open ? '#6366F1' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>

        {/* ─── Mobile dropdown menu ───────────────────────────── */}
        <div style={{
          maxHeight: open ? '320px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)',
          borderTop: open ? '1px solid var(--border)' : 'none',
          background: 'rgba(8,12,20,0.98)',
        }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Nav links */}
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', borderRadius: 9, textDecoration: 'none',
                    background: active ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                    color:      active ? '#6366F1' : 'var(--text-secondary)',
                    fontFamily: 'JetBrains Mono', fontSize: '0.82rem', fontWeight: 600,
                    border: `1px solid ${active ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}

            {/* Divider */}
            {user && <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />}

            {/* User info on mobile */}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.82rem', fontWeight: 700, color: 'white',
                  }}>
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '0.84rem', fontWeight: 600, margin: 0 }}>{user.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.66rem', fontFamily: 'JetBrains Mono', margin: 0 }}>Signed in</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  aria-label="Sign out"
                  style={{
                    padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.06)', color: '#ef4444',
                    fontFamily: 'JetBrains Mono', fontSize: '0.68rem', cursor: 'pointer',
                  }}
                >Logout</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ─── CSS ─────────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 767px) {
          .hidden-mobile { display: none !important; }
          .show-mobile   { display: flex !important; }
        }
        @media (min-width: 768px) {
          .show-mobile { display: none !important; }
          .hidden-mobile { display: flex !important; }
        }
      `}</style>
    </>
  )
}
