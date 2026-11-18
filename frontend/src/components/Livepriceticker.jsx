import { useState, useEffect, useCallback } from 'react'
import { apiUrl } from '../utils/apiBase'

const REFRESH_MS = 15 * 60 * 1000  // 15 minutes

function fmt(val, prefix = '₹') {
  if (val === null || val === undefined) return 'N/A'
  return `${prefix}${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function fmtVol(val) {
  if (!val) return 'N/A'
  if (val >= 1e7) return `${(val / 1e7).toFixed(2)}Cr`
  if (val >= 1e5) return `${(val / 1e5).toFixed(2)}L`
  return val.toLocaleString('en-IN')
}

export default function LivePriceTicker({ symbol, initialData = null }) {
  const [priceData, setPriceData] = useState(initialData)
  const [loading,   setLoading]   = useState(!initialData)
  const [error,     setError]     = useState(null)
  const [lastFetch, setLastFetch] = useState(() => (
    initialData?.last_updated ? new Date(initialData.last_updated) : null
  ))

  const fetchPrice = useCallback(async () => {
    if (!symbol) return
    try {
      setError(null)
      const resp = await fetch(apiUrl(`/api/live-price/${symbol}`))
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setPriceData(data)
      setLastFetch(new Date())
    } catch (err) {
      if (!initialData) setError('Live price unavailable — NSE may be closed')
    } finally {
      setLoading(false)
    }
  }, [symbol, initialData])

  // Fetch on mount and every 15 minutes
  useEffect(() => {
    setLoading(!initialData)
    setPriceData(initialData)
    setLastFetch(initialData?.last_updated ? new Date(initialData.last_updated) : null)
    setError(null)
    fetchPrice()
    const interval = setInterval(fetchPrice, REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchPrice, initialData])

  const isUp      = priceData?.day_change_pct > 0
  const isDown    = priceData?.day_change_pct < 0
  const changeClr = isUp ? '#22c55e' : isDown ? '#ef4444' : 'var(--text-muted)'
  const changePfx = isUp ? '▲' : isDown ? '▼' : '●'

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '10px 16px', marginBottom: 16,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        {[100, 80, 90, 70, 110].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 14, width: w, borderRadius: 4 }} />
        ))}
      </div>
    )
  }

  // ── Error / unavailable ──
  if (error || !priceData) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', marginBottom: 16,
        background: 'rgba(234,179,8,0.04)',
        border: '1px solid rgba(234,179,8,0.15)',
        borderRadius: 8,
      }}>
        <span style={{ color: '#eab308', fontSize: '0.65rem' }}>○</span>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.65rem' }}>
          {error || 'Live price data unavailable'}
        </span>
        <button
          onClick={fetchPrice}
          style={{
            marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.6rem',
            padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 20px',
      padding: '10px 16px', marginBottom: 16,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 8, position: 'relative',
    }}>
      {/* Live dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span className="pulse-dot" style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: '#22c55e',
        }} />
        <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', letterSpacing: '0.08em' }}>
          LIVE
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
        <span style={{
          fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: '1rem',
          color: 'var(--text-primary)',
        }}>
          {fmt(priceData.live_price)}
        </span>
        {priceData.day_change_pct !== null && (
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem', fontWeight: 600, color: changeClr }}>
            {changePfx} {Math.abs(priceData.day_change_pct).toFixed(2)}%
          </span>
        )}
        {priceData.day_change !== null && (
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: changeClr, opacity: 0.8 }}>
            ({priceData.day_change > 0 ? '+' : ''}{priceData.day_change?.toFixed(2)})
          </span>
        )}
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

      {/* Day range */}
      {(priceData.day_high || priceData.day_low) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
            DAY RANGE
          </span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
            {fmt(priceData.day_low)} – {fmt(priceData.day_high)}
          </span>
        </div>
      )}

      {/* 52-week range */}
      {(priceData.week52_high || priceData.week52_low) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
            52W RANGE
          </span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
            {fmt(priceData.week52_low)} – {fmt(priceData.week52_high)}
          </span>
        </div>
      )}

      {/* Volume */}
      {priceData.volume && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
            VOLUME
          </span>
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: '0.68rem',
            color: priceData.volume_anomaly ? '#ef4444' : 'var(--text-secondary)',
            fontWeight: priceData.volume_anomaly ? 700 : 400,
          }}>
            {fmtVol(priceData.volume)}
            {priceData.volume_ratio && (
              <span style={{ marginLeft: 4, opacity: 0.75 }}>
                ({priceData.volume_ratio}x avg)
              </span>
            )}
          </span>
        </div>
      )}

      {/* Volume anomaly badge */}
      {priceData.volume_anomaly && (
        <span style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#ef4444', fontFamily: 'JetBrains Mono', fontSize: '0.58rem',
          fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          letterSpacing: '0.06em', flexShrink: 0,
          animation: 'pulse 2s infinite',
        }}>
          ⚡ VOLUME SPIKE
        </span>
      )}

      {/* Circuit limits */}
      {(priceData.circuit_up || priceData.circuit_down) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
            CIRCUIT
          </span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: '#ef4444' }}>{fmt(priceData.circuit_down)}</span>
            {' – '}
            <span style={{ color: '#22c55e' }}>{fmt(priceData.circuit_up)}</span>
          </span>
        </div>
      )}

      {/* Last updated — right aligned */}
      {lastFetch && (
        <span style={{
          marginLeft: 'auto', color: 'var(--text-muted)',
          fontFamily: 'JetBrains Mono', fontSize: '0.58rem', flexShrink: 0,
        }}>
          {lastFetch.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50%       { opacity: 0.6 }
        }
      `}</style>
    </div>
  )
}
