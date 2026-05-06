import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  getSavedPortfolio, addToPortfolio, removeFromPortfolio,
  analyzePortfolio,
} from '../utils/api'
import { getCachedState, setCachedState } from '../utils/viewStateCache'

const RISK_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MODERATE: '#eab308', LOW: '#22c55e' }
function riskColor(l) { return RISK_COLORS[l] || '#eab308' }

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } } }

/* ── Add Symbol Input ────────────────────────────────────────────── */
function AddSymbolInput({ onAdd, adding, currentCount }) {
  const [val, setVal] = useState('')
  const max = 20

  function handleSubmit(e) {
    e?.preventDefault()
    const syms = val.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    if (syms.length > 0) { onAdd(syms); setVal('') }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value.toUpperCase())}
        placeholder="Enter NSE symbols (e.g. TCS, INFY)…"
        disabled={adding || currentCount >= max}
        style={{
          flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', fontFamily: 'JetBrains Mono', fontSize: '0.8rem',
          outline: 'none', transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = '#6366F150'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
      <button
        type="submit"
        disabled={!val.trim() || adding || currentCount >= max}
        className="btn-primary"
        style={{ padding: '10px 20px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
      >
        {adding ? '⏳ Adding…' : '+ Add'}
      </button>
      <span style={{ width: '100%', color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono' }}>
        Comma-separated · {currentCount}/{max} saved
      </span>
    </form>
  )
}

/* ── Company Card ────────────────────────────────────────────────── */
function CompanyCard({ symbol, onRemove, removing }) {
  return (
    <motion.div
      variants={fadeUp}
      layout
      className="card"
      style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '0.85rem',
          color: '#6366F1',
        }}>
          {symbol.charAt(0)}
        </div>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {symbol}
        </span>
      </div>
      <button
        onClick={() => onRemove(symbol)}
        disabled={removing}
        aria-label={`Remove ${symbol}`}
        style={{
          padding: '5px 12px', borderRadius: 6,
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.65rem',
          cursor: removing ? 'not-allowed' : 'pointer', fontWeight: 600,
          transition: 'all 0.15s',
        }}
      >
        {removing ? '…' : '✕ Remove'}
      </button>
    </motion.div>
  )
}

/* ── Analysis Results Summary ────────────────────────────────────── */
function AnalysisResults({ result, onDrillDown }) {
  const s = result.portfolio_summary
  if (!s) return null

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary banner */}
      <motion.div variants={fadeUp} style={{
        background: 'linear-gradient(135deg, rgba(234,179,8,0.06), rgba(99,102,241,0.04))',
        border: '1px solid rgba(234,179,8,0.2)', borderRadius: 12,
        padding: '18px 22px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <p style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 2px' }}>
            Watchlist Risk Overview
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', margin: 0 }}>
            {s.total_companies} companies analyzed
          </p>
        </div>
        <span style={{
          background: `${riskColor(s.average_risk_level)}15`, color: riskColor(s.average_risk_level),
          border: `1px solid ${riskColor(s.average_risk_level)}30`,
          padding: '6px 18px', borderRadius: 20,
          fontFamily: 'JetBrains Mono', fontSize: '0.75rem', fontWeight: 700,
        }}>
          AVG: {s.average_risk_level} ({s.average_fraud_score}/100)
        </span>
      </motion.div>

      {/* KPI row */}
      <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Avg Score', val: s.average_fraud_score, color: riskColor(s.average_risk_level) },
          { label: 'Highest Risk', val: `${s.highest_risk.nse_symbol} (${s.highest_risk.fraud_score})`, color: '#ef4444' },
          { label: 'Lowest Risk', val: `${s.lowest_risk.nse_symbol} (${s.lowest_risk.fraud_score})`, color: '#22c55e' },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '14px 18px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>{c.label}</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Poppins', color: c.color, margin: 0 }}>{c.val}</p>
          </div>
        ))}
      </motion.div>

      {/* Company list */}
      <motion.div variants={fadeUp} className="card" style={{ padding: '18px 0 0' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px', padding: '0 20px' }}>
          Company Results — Click to drill down
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Company', 'Symbol', 'Score', 'Risk', 'Sector'].map(h => (
                  <th key={h} style={{
                    padding: '9px 14px', background: 'rgba(0,0,0,0.2)',
                    color: 'var(--text-muted)', fontSize: '0.62rem', fontFamily: 'JetBrains Mono',
                    textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.companies || []).map(c => {
                const rc = riskColor(c.risk_level)
                return (
                  <tr
                    key={c.nse_symbol}
                    onClick={() => onDrillDown(c.nse_symbol)}
                    className="hover-row"
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 500 }}>{c.company_name}</td>
                    <td style={{ padding: '10px 14px', color: '#6366F1', fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>{c.nse_symbol}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: rc, fontFamily: 'JetBrains Mono', fontSize: '0.82rem', fontWeight: 700 }}>{c.fraud_score}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        background: `${rc}18`, color: rc, border: `1px solid ${rc}30`,
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.62rem',
                        fontFamily: 'JetBrains Mono', fontWeight: 700,
                      }}>{c.risk_level}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{c.sector || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════ */
export default function SavedPortfolioPage() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const cached = getCachedState('watchlistPage')
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingSymbol, setRemovingSymbol] = useState(null)
  const [error, setError] = useState(null)

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(cached?.analysisResult || null)
  const [analysisError, setAnalysisError] = useState(cached?.analysisError || null)

  const fetchPortfolio = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSavedPortfolio(token)
      setCompanies(data.companies || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchPortfolio() }, [fetchPortfolio])

  useEffect(() => {
    setCachedState('watchlistPage', { analysisResult, analysisError })
  }, [analysisResult, analysisError])

  async function handleAdd(symbols) {
    setAdding(true)
    setError(null)
    try {
      const data = await addToPortfolio(token, symbols)
      setCompanies(data.companies || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(symbol) {
    setRemovingSymbol(symbol)
    try {
      const data = await removeFromPortfolio(token, symbol)
      setCompanies(data.companies || [])
      // Clear analysis if it included this company
      if (analysisResult) setAnalysisResult(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setRemovingSymbol(null)
    }
  }

  async function handleAnalyzeAll() {
    if (companies.length < 2) return
    setAnalyzing(true)
    setAnalysisError(null)
    setAnalysisResult(null)
    try {
      const data = await analyzePortfolio(companies)
      setAnalysisResult(data)
    } catch (err) {
      setAnalysisError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  function handleDrillDown(symbol) {
    navigate(`/?company=${symbol}`)
  }

  return (
    <div className="min-h-screen grid-bg" style={{ background: 'var(--bg-primary)' }}>
      {/* Ambient glow */}
      <div aria-hidden="true" style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 700, height: 260,
        background: 'radial-gradient(ellipse, rgba(234,179,8,0.05) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <Navbar />

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 64px', position: 'relative', zIndex: 1 }}>

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
            }}>⭐</div>
            <div>
              <h1 style={{
                fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.3rem',
                color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em',
              }}>
                Saved <span style={{ color: '#eab308' }}>Watchlist</span>
              </h1>
              <p style={{
                color: 'var(--text-muted)', fontSize: '0.7rem',
                fontFamily: 'JetBrains Mono', margin: '2px 0 0', letterSpacing: '0.04em',
              }}>
                {loading ? 'Loading…' : `${companies.length} saved compan${companies.length !== 1 ? 'ies' : 'y'}`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Add companies card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card" style={{ padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
            }}>➕</div>
            <h3 style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              Add Companies
            </h3>
          </div>
          <AddSymbolInput onAdd={handleAdd} adding={adding} currentCount={companies.length} />
        </motion.div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          }}>
            <p style={{ color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.78rem', margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton card" style={{ height: 66, borderRadius: 10 }} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && companies.length === 0 && !error && (
          <motion.div variants={stagger} initial="hidden" animate="show" style={{ textAlign: 'center', padding: '50px 20px' }}>
            <motion.div variants={fadeUp} style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', margin: '0 auto 16px',
            }}>⭐</motion.div>
            <motion.h2 variants={fadeUp} style={{ fontFamily: 'Poppins', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', margin: '0 0 8px' }}>
              No Saved Companies
            </motion.h2>
            <motion.p variants={fadeUp} style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0 0 20px', lineHeight: 1.6 }}>
              Add NSE symbols above or save companies from the Dashboard analysis view.
            </motion.p>
          </motion.div>
        )}

        {/* Saved companies list */}
        {!loading && companies.length > 0 && (
          <>
            <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <AnimatePresence>
                {companies.map(sym => (
                  <CompanyCard
                    key={sym}
                    symbol={sym}
                    onRemove={handleRemove}
                    removing={removingSymbol === sym}
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Analyze All button */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <button
                onClick={handleAnalyzeAll}
                disabled={companies.length < 2 || analyzing}
                className="btn-primary"
                style={{ width: '100%', padding: '13px', fontSize: '0.85rem', marginBottom: 24 }}
              >
                {analyzing ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    {' '}Analyzing {companies.length} companies…
                  </>
                ) : (
                  <>🔍 Analyze All ({companies.length} companies)</>
                )}
              </button>
              {companies.length < 2 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'JetBrains Mono', textAlign: 'center', marginTop: -16 }}>
                  Add at least 2 companies to run portfolio analysis
                </p>
              )}
            </motion.div>
          </>
        )}

        {/* Analysis error */}
        {analysisError && (
          <div style={{
            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '14px 18px', marginBottom: 18,
          }}>
            <p style={{ color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', margin: 0 }}>⚠ {analysisError}</p>
          </div>
        )}

        {/* Analysis loading */}
        {analyzing && (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(234,179,8,0.2)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-primary)', fontFamily: 'Poppins', fontWeight: 700, fontSize: '1rem', margin: '0 0 6px' }}>
              Analyzing watchlist…
            </p>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', margin: 0 }}>
              Fetching real financial data · NSE validation · Fraud scoring
            </p>
          </div>
        )}

        {/* Analysis results */}
        {analysisResult && !analyzing && (
          <AnalysisResults result={analysisResult} onDrillDown={handleDrillDown} />
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
