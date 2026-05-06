import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getHistory, deleteHistory } from '../utils/api'

/* ── Framer Motion Config ────────────────────────────────────────── */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const fadeUpItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } },
}

/* ── Risk color helpers ──────────────────────────────────────────── */
function riskColor(level) {
  const l = (level || '').toLowerCase()
  if (l === 'critical' || l === 'high') return '#ef4444'
  if (l === 'medium' || l === 'moderate') return '#f59e0b'
  return '#22c55e'
}

function scoreColor(score) {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f59e0b'
  return '#22c55e'
}

function relativeTime(iso) {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Skeleton loader ─────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="history-card-skeleton">
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '35%', borderRadius: 4 }} />
      </div>
      <div className="skeleton" style={{ width: 48, height: 28, borderRadius: 6 }} />
    </div>
  )
}

/* ── Delete confirmation modal ───────────────────────────────────── */
function DeleteModal({ item, onConfirm, onCancel, deleting }) {
  return (
    <motion.div
      className="history-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="history-modal-card card"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Warning icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', margin: '0 auto 16px',
        }}>🗑️</div>

        <h3 style={{
          fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1rem',
          color: 'var(--text-primary)', margin: '0 0 6px', textAlign: 'center',
        }}>Delete Analysis?</h3>

        <p style={{
          color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center',
          margin: '0 0 20px', lineHeight: 1.6,
        }}>
          Remove <strong style={{ color: 'var(--text-primary)' }}>{item?.company}</strong> analysis from your history. This cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9,
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono',
              fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              letterSpacing: '0.06em', transition: 'all 0.15s',
            }}
          >CANCEL</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9,
              background: deleting ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontFamily: 'JetBrains Mono',
              fontSize: '0.72rem', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {deleting && <div className="auth-spinner-small" style={{ borderTopColor: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }} />}
            {deleting ? 'DELETING...' : 'DELETE'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── History card ────────────────────────────────────────────────── */
function HistoryCard({ item, onOpen, onDelete, index }) {
  const sc = scoreColor(item.fraud_score)
  const rc = riskColor(item.risk_level)

  return (
    <motion.div
      className="history-card card"
      variants={fadeUpItem}
      layout
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      style={{ cursor: 'pointer' }}
      onClick={() => onOpen(item)}
    >
      {/* Company avatar */}
      <div className="history-card-avatar" style={{
        background: `linear-gradient(135deg, ${sc}18, ${sc}08)`,
        border: `1px solid ${sc}30`,
      }}>
        <span style={{ fontSize: '1rem' }}>
          {item.company?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>

      {/* Info */}
      <div className="history-card-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p className="history-card-company">{item.company}</p>
          <span className="history-card-symbol">{item.nse_symbol}</span>
        </div>
        <p className="history-card-date">{relativeTime(item.createdAt)}</p>
      </div>

      {/* Score */}
      <div className="history-card-score-section">
        <div className="history-card-score" style={{ color: sc, borderColor: `${sc}30` }}>
          {item.fraud_score}
        </div>
        <span className="history-card-risk" style={{
          color: rc, background: `${rc}12`, border: `1px solid ${rc}25`,
        }}>
          {item.risk_level}
        </span>
      </div>

      {/* Delete button */}
      <button
        className="history-card-delete"
        onClick={e => { e.stopPropagation(); onDelete(item) }}
        aria-label={`Delete ${item.company} analysis`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </motion.div>
  )
}

/* ── Empty state ─────────────────────────────────────────────────── */
function EmptyState() {
  const navigate = useNavigate()
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 20px', maxWidth: 460, margin: '0 auto',
      }}
    >
      <motion.div variants={fadeUpItem} style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.6rem', marginBottom: 18, boxShadow: '0 0 32px rgba(99,102,241,0.07)',
      }}>📋</motion.div>

      <motion.h2 variants={fadeUpItem} style={{
        fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.15rem',
        color: 'var(--text-primary)', margin: '0 0 8px', textAlign: 'center',
      }}>No Analysis History</motion.h2>

      <motion.p variants={fadeUpItem} style={{
        color: 'var(--text-secondary)', fontSize: '0.84rem', textAlign: 'center',
        margin: '0 0 24px', lineHeight: 1.65,
      }}>
        Analyze an NSE-listed company from the Dashboard and your results will automatically appear here.
      </motion.p>

      <motion.button
        variants={fadeUpItem}
        className="btn-primary"
        onClick={() => navigate('/')}
        style={{ padding: '10px 28px', fontSize: '0.8rem', fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
      >
        Go to Dashboard →
      </motion.button>
    </motion.div>
  )
}

/* ── Error state ─────────────────────────────────────────────────── */
function ErrorState({ error, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.2rem', margin: '0 auto 14px',
      }}>⚠️</div>
      <p style={{ color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', margin: '0 0 6px' }}>
        {error}
      </p>
      <button
        onClick={onRetry}
        style={{
          marginTop: 12, padding: '8px 20px', borderRadius: 8,
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          color: '#6366F1', fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
          cursor: 'pointer', fontWeight: 600,
        }}
      >Retry</button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MAIN HISTORY PAGE
   ══════════════════════════════════════════════════════════════════ */
export default function HistoryPage() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getHistory(token)
      setItems(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteHistory(token, deleteTarget.id)
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  function handleOpen(item) {
    // Navigate to dashboard with the history record ID so it can load the full data
    navigate(`/?history=${item.id}`)
  }

  return (
    <div className="min-h-screen grid-bg" style={{ background: 'var(--bg-primary)' }}>
      {/* Ambient glow */}
      <div aria-hidden="true" style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 700, height: 260,
        background: 'radial-gradient(ellipse, rgba(99,102,241,0.05) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <Navbar />

      <main
        className="page-container"
        style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 64px', position: 'relative', zIndex: 1 }}
      >
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          style={{ marginBottom: 28 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
            }}>🕒</div>
            <div>
              <h1 style={{
                fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.3rem',
                color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em',
              }}>Analysis History</h1>
              <p style={{
                color: 'var(--text-muted)', fontSize: '0.7rem',
                fontFamily: 'JetBrains Mono', margin: '2px 0 0',
                letterSpacing: '0.04em',
              }}>
                {loading ? 'Loading...' : `${items.length} analysis record${items.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && <ErrorState error={error} onRetry={fetchHistory} />}

        {/* Empty state */}
        {!loading && !error && items.length === 0 && <EmptyState />}

        {/* History list */}
        {!loading && !error && items.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {items.map((item, idx) => (
              <HistoryCard
                key={item.id}
                item={item}
                index={idx}
                onOpen={handleOpen}
                onDelete={setDeleteTarget}
              />
            ))}
          </motion.div>
        )}
      </main>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            item={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
