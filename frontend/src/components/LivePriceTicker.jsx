import { useState, useEffect, useCallback, useRef } from 'react'
import { getLivePrice } from '../utils/api'

// Refresh intervals: 30 seconds when market is open, 5 minutes when closed
const REFRESH_INTERVAL_OPEN = 30 * 1000
const REFRESH_INTERVAL_CLOSED = 5 * 60 * 1000

function fmt(val, prefix = '₹') {
  if (val === null || val === undefined || isNaN(val)) return 'N/A'
  return `${prefix}${Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtVol(val) {
  if (!val || isNaN(val)) return 'N/A'
  if (val >= 1e7) return `${(val / 1e7).toFixed(2)} Cr`
  if (val >= 1e5) return `${(val / 1e5).toFixed(2)} L`
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)} K`
  return Number(val).toLocaleString('en-IN')
}

export default function LivePriceTicker({ symbol, companyName: defaultCompanyName }) {
  const [priceData, setPriceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastFetchTime, setLastFetchTime] = useState(null)
  const timerRef = useRef(null)

  const fetchPrice = useCallback(
    async (isManual = false) => {
      if (!symbol) return
      if (isManual) {
        setRefreshing(true)
      }
      try {
        setError(null)
        const data = await getLivePrice(symbol)
        setPriceData(data)
        setLastFetchTime(new Date())
      } catch (err) {
        console.error('[LivePriceTicker] Failed to fetch price:', err)
        setError(err.message || 'Live price unavailable — NSE may be closed or symbol unlisted')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [symbol]
  )

  // Primary fetch + polling. NOTE: this effect must NOT depend on priceData,
  // or it would loop forever — it resets priceData, which would change the
  // dependency and re-trigger the effect on every fetch (the ticker then never
  // leaves its loading skeleton). It re-runs only when the symbol changes.
  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setPriceData(null)
    setError(null)
    fetchPrice(false)

    if (timerRef.current) clearInterval(timerRef.current)
    // Poll on a fixed interval; each response carries its own freshness label.
    const intervalMs = isMarketOpen ? REFRESH_INTERVAL_OPEN : REFRESH_INTERVAL_CLOSED
    timerRef.current = setInterval(() => {
      fetchPrice(false)
    }, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, fetchPrice])

  // Price direction calculations
  const change = priceData?.day_change
  const changePct = priceData?.day_change_pct
  const isUp = changePct > 0
  const isDown = changePct < 0
  const changeColor = isUp ? '#22c55e' : isDown ? '#ef4444' : 'var(--text-muted, #94a3b8)'
  const changeIcon = isUp ? '▲' : isDown ? '▼' : '●'

  const marketStatus = priceData?.market_status || {}
  const isMarketOpen = marketStatus.is_open === true
  const companyName = priceData?.company_name || defaultCompanyName || symbol

  // Data freshness label mapping — driven by both data_type AND price_status
  // price_status (from backend) is the authoritative label when present;
  // data_type is the fallback for backward compatibility.
  const dataTypeLabels = {
    near_real_time:   { label: 'Near Real-Time (NSE)',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    latest_available: { label: 'Last Traded Price (NSE)',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    delayed:          { label: 'Cached (Delayed)',            color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
    last_close:       { label: 'Last Available (Yahoo Finance)', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
    fallback:         { label: 'Last Available (Yahoo Finance)', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  }
  // price_status map — overrides data_type label when present
  const priceStatusLabels = {
    'LIVE':              { label: 'NSE Live',                     color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    'LAST TRADED PRICE': { label: 'Last Traded Price (NSE)',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    'LAST AVAILABLE':    { label: 'Last Available (Yahoo Finance)', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
    'PREVIOUS CLOSE':    { label: 'Previous Close (Yahoo Finance)', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
    'CACHED':            { label: 'Cached (Delayed)',              color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
    'UNAVAILABLE':       { label: 'Unavailable',                  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  }
  const priceStatus = priceData?.price_status
  const currentFreshness =
    (priceStatus && priceStatusLabels[priceStatus]) ||
    dataTypeLabels[priceData?.data_type] ||
    dataTypeLabels.latest_available

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div
        className="live-price-strip skeleton-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px 24px',
          alignItems: 'center',
          padding: '14px 20px',
          marginBottom: 16,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="skeleton" style={{ height: 16, width: 80, borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 16, width: 140, borderRadius: 4 }} />
        </div>
        <div className="skeleton" style={{ height: 24, width: 120, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 16, width: 180, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 16, width: 90, borderRadius: 4, marginLeft: 'auto' }} />
      </div>
    )
  }

  // ── Error / Unavailable state ──
  if (error && !priceData) {
    return (
      <div
        className="live-price-strip error-state"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          marginBottom: 16,
          background: 'rgba(234,179,8,0.04)',
          border: '1px solid rgba(234,179,8,0.2)',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#eab308', fontSize: '0.9rem' }}>⚠</span>
          <div>
            <div style={{ color: 'var(--text-primary, #f8fafc)', fontSize: '0.78rem', fontWeight: 600 }}>
              Live Price Unavailable for {symbol}
            </div>
            <div style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'JetBrains Mono', fontSize: '0.65rem', marginTop: 2 }}>
              {error}
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchPrice(true)}
          disabled={refreshing}
          style={{
            background: 'rgba(234,179,8,0.1)',
            border: '1px solid rgba(234,179,8,0.3)',
            color: '#eab308',
            fontFamily: 'JetBrains Mono',
            fontSize: '0.68rem',
            padding: '4px 12px',
            borderRadius: 6,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s',
          }}
        >
          <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s' }}>
            🔄
          </span>
          {refreshing ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  return (
    <div
      className="live-price-strip"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 20px',
        marginBottom: 16,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: 10,
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* ── Top Header Row: Symbol, Company Name, Badges & Controls ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Market Status Dot & Badge — only show NSE LIVE when actually from NSE */}
          <div
            title={marketStatus.reason || (isMarketOpen ? 'NSE market session is active' : 'NSE market is currently closed')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: isMarketOpen ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
              border: `1px solid ${isMarketOpen ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
              padding: '2px 8px',
              borderRadius: 20,
            }}
          >
            <span
              className={isMarketOpen && priceData?.source === 'NSE' ? 'pulse-dot' : ''}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isMarketOpen ? '#22c55e' : '#eab308',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: isMarketOpen ? '#22c55e' : '#eab308',
              }}
            >
              {isMarketOpen ? 'NSE OPEN' : 'NSE CLOSED'}
            </span>
          </div>

          {/* NSE Symbol */}
          <span
            style={{
              fontFamily: 'JetBrains Mono',
              fontWeight: 700,
              fontSize: '0.88rem',
              color: 'var(--text-primary, #f8fafc)',
              letterSpacing: '0.04em',
            }}
          >
            NSE: {symbol.toUpperCase()}
          </span>

          {/* Company Name */}
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary, #cbd5e1)',
              fontWeight: 500,
              maxWidth: 280,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={companyName}
          >
            {companyName}
          </span>

          {/* Freshness / Source Badge */}
          <span
            style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.58rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 4,
              background: currentFreshness.bg,
              color: currentFreshness.color,
              border: `1px solid ${currentFreshness.color}33`,
            }}
          >
            {currentFreshness.label}
          </span>
        </div>

        {/* Right side: Manual Refresh Button & Last Updated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          {lastFetchTime && (
            <span
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontFamily: 'JetBrains Mono',
                fontSize: '0.62rem',
              }}
              title={`Last updated at ${lastFetchTime.toLocaleString('en-IN')}`}
            >
              Updated: {lastFetchTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}

          <button
            onClick={() => fetchPrice(true)}
            disabled={refreshing}
            title="Refresh latest market price"
            style={{
              background: refreshing ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border, rgba(255,255,255,0.1))',
              color: refreshing ? '#6366f1' : 'var(--text-secondary, #cbd5e1)',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.65rem',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 6,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: refreshing ? 'rotate(360deg)' : 'none',
                transition: 'transform 0.6s ease',
              }}
            >
              ↻
            </span>
            {refreshing ? 'Updating…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Main Price & Metrics Row ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px 24px',
          paddingTop: 6,
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Current / Latest Price & Change */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: 'JetBrains Mono',
              fontWeight: 800,
              fontSize: '1.25rem',
              color: 'var(--text-primary, #ffffff)',
              letterSpacing: '-0.02em',
            }}
          >
            {fmt(priceData.live_price)}
          </span>

          {changePct !== null && changePct !== undefined && (
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: changeColor,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span>{changeIcon}</span>
              <span>{change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)}</span>
              <span>({changePct >= 0 ? `+${changePct.toFixed(2)}` : changePct.toFixed(2)}%)</span>
            </span>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border, rgba(255,255,255,0.08))', flexShrink: 0 }} />

        {/* Previous Close */}
        {priceData.prev_close !== null && priceData.prev_close !== undefined && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
              PREV CLOSE
            </span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.74rem', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>
              {fmt(priceData.prev_close)}
            </span>
          </div>
        )}

        {/* Open Price */}
        {priceData.open !== null && priceData.open !== undefined && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
              OPEN
            </span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.74rem', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>
              {fmt(priceData.open)}
            </span>
          </div>
        )}

        {/* Day Range */}
        {(priceData.day_high || priceData.day_low) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
              DAY RANGE
            </span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.74rem', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>
              {fmt(priceData.day_low)} – {fmt(priceData.day_high)}
            </span>
          </div>
        )}

        {/* 52-Week Range */}
        {(priceData.week52_high || priceData.week52_low) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
              52W RANGE
            </span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.74rem', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>
              {fmt(priceData.week52_low)} – {fmt(priceData.week52_high)}
            </span>
          </div>
        )}

        {/* Traded Volume */}
        {priceData.volume && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
              VOLUME
            </span>
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '0.74rem',
                color: priceData.volume_anomaly ? '#ef4444' : 'var(--text-secondary, #cbd5e1)',
                fontWeight: priceData.volume_anomaly ? 700 : 600,
              }}
            >
              {fmtVol(priceData.volume)}
              {priceData.volume_ratio && (
                <span style={{ marginLeft: 4, opacity: 0.8, fontSize: '0.62rem' }}>
                  ({priceData.volume_ratio}x avg)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Volume Anomaly Spike Badge */}
        {priceData.volume_anomaly && (
          <span
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.6rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              letterSpacing: '0.05em',
              flexShrink: 0,
              animation: 'pulse 2s infinite',
            }}
          >
            ⚡ VOLUME SPIKE
          </span>
        )}

        {/* Circuit Limits */}
        {(priceData.circuit_up || priceData.circuit_down) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'JetBrains Mono', fontSize: '0.55rem', letterSpacing: '0.06em' }}>
              CIRCUIT LIMITS
            </span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.74rem', fontWeight: 600 }}>
              <span style={{ color: '#ef4444' }}>{fmt(priceData.circuit_down)}</span>
              {' – '}
              <span style={{ color: '#22c55e' }}>{fmt(priceData.circuit_up)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Fallback note — shown when using Yahoo Finance instead of NSE */}
      {priceData.fallback_note && (
        <div
          style={{
            fontSize: '0.65rem',
            fontFamily: 'JetBrains Mono',
            color: '#a855f7',
            background: 'rgba(168,85,247,0.06)',
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid rgba(168,85,247,0.2)',
          }}
        >
          ℹ {priceData.fallback_note}
        </div>
      )}

      {/* Data source info for transparency */}
      {priceData.source && (
        <div
          style={{
            fontSize: '0.6rem',
            fontFamily: 'JetBrains Mono',
            color: 'var(--text-muted, #64748b)',
            marginTop: 2,
          }}
        >
          Source: {priceData.source}
          {priceData.nse_error_code && priceData.nse_error_code !== 'NSE_PROVIDER_UNAVAILABLE' && (
            <span style={{ marginLeft: 8, color: '#eab308' }}>NSE: {priceData.nse_error_code}</span>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.98); }
        }
        .pulse-dot {
          animation: pulse 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  )
}