import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { getHistoricalPrices, syncHistoricalPrices } from '../utils/api'

const PERIODS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '3y', label: '3Y' },
  { key: '5y', label: '5Y' },
  { key: '10y', label: '10Y' },
  { key: 'max', label: 'MAX' },
]

function formatPrice(val) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
  })
}

export default function HistoricalPriceChart({ symbol, onRangeChange }) {
  const [period, setPeriod] = useState('10y')
  const [chartData, setChartData] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!symbol) return
    loadData(symbol, period)
  }, [symbol, period])

  async function loadData(sym, p) {
    setLoading(true)
    setError(null)
    try {
      const res = await getHistoricalPrices(sym, p)
      if (res && res.records) {
        setChartData(res.records)
        const metadata = {
          count: res.count,
          startDate: res.start_date,
          endDate: res.end_date,
          yearsAvailable: res.years_available,
          warning: res.warning,
          dataAvailable: res.data_available,
          period: p,
        }
        setMeta(metadata)
        if (onRangeChange) {
          onRangeChange(metadata)
        }
      } else {
        setChartData([])
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch historical market data')
      setChartData([])
    } finally {
      setLoading(false)
    }
  }

  async function handleRefreshSync() {
    if (!symbol || syncing) return
    setSyncing(true)
    setError(null)
    try {
      await syncHistoricalPrices(symbol)
      await loadData(symbol, period)
    } catch (err) {
      setError(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (!symbol) return null

  // Calculate return over the selected period
  const firstClose = chartData[0]?.close
  const lastClose = chartData[chartData.length - 1]?.close
  const priceChange = firstClose && lastClose ? lastClose - firstClose : 0
  const pctChange = firstClose && lastClose ? (priceChange / firstClose) * 100 : 0
  const isPositive = priceChange >= 0

  return (
    <div
      style={{
        background: '#0d1527',
        border: '1px solid #1e2d42',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 24,
      }}
    >
      {/* Header with Title, Price, Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                color: 'var(--text-primary)',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
              }}
            >
              Historical Market Performance (Up to 10 Years)
            </h3>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                fontFamily: 'JetBrains Mono',
              }}
            >
              {symbol}.NS
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginTop: 6,
            }}
          >
            {lastClose !== undefined && (
              <span
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {formatPrice(lastClose)}
              </span>
            )}
            {chartData.length > 1 && (
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  fontFamily: 'JetBrains Mono',
                  color: isPositive ? '#10b981' : '#ef4444',
                }}
              >
                {isPositive ? '+' : ''}
                {formatPrice(priceChange)} ({isPositive ? '+' : ''}
                {pctChange.toFixed(2)}%)
              </span>
            )}
            {meta?.startDate && meta?.endDate && (
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {meta.startDate} to {meta.endDate} ({meta.count} trading sessions)
              </span>
            )}
          </div>
        </div>

        {/* Range selectors and refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              background: '#070b14',
              padding: 3,
              borderRadius: 8,
              border: '1px solid #1e2d42',
            }}
          >
            {PERIODS.map((p) => {
              const active = period === p.key
              return (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: active ? '#6366F1' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-muted)',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '0.68rem',
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleRefreshSync}
            disabled={syncing || loading}
            title="Sync latest 10-year data from provider"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #2d3b55',
              background: syncing ? '#1e293b' : 'transparent',
              color: 'var(--text-secondary)',
              cursor: syncing || loading ? 'not-allowed' : 'pointer',
              fontSize: '0.72rem',
              fontFamily: 'JetBrains Mono',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {syncing ? '↻ Syncing…' : '↻ Sync Data'}
          </button>
        </div>
      </div>

      {/* Warning when less than 10 years available */}
      {meta?.warning && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: '0.75rem',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>ℹ️</span>
          <span>{meta.warning}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: '0.75rem',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      {/* Chart visualization */}
      <div style={{ width: '100%', height: 260, position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(13, 21, 39, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono',
            }}
          >
            Loading 10-year market history…
          </div>
        )}

        {chartData.length === 0 && !loading ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              fontFamily: 'JetBrains Mono',
              gap: 8,
            }}
          >
            <span>No historical price data recorded yet for {symbol}.</span>
            <button
              onClick={handleRefreshSync}
              style={{
                padding: '6px 14px',
                background: '#6366F1',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Fetch 10-Year History Now
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? '#10b981' : '#ef4444'}
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? '#10b981' : '#ef4444'}
                    stopOpacity={0.0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#152033" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#2d3b55"
                tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                orientation="right"
                stroke="#2d3b55"
                tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0].payload
                  return (
                    <div
                      style={{
                        background: 'rgba(10, 17, 32, 0.95)',
                        border: '1px solid #1e2d42',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '0.72rem',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                      }}
                    >
                      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
                        {item.date}
                      </div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                        Close: {formatPrice(item.close)}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto auto',
                          gap: '2px 10px',
                          marginTop: 6,
                          color: 'var(--text-secondary)',
                          fontSize: '0.68rem',
                        }}
                      >
                        <span>Open:</span>
                        <span>{formatPrice(item.open)}</span>
                        <span>High:</span>
                        <span>{formatPrice(item.high)}</span>
                        <span>Low:</span>
                        <span>{formatPrice(item.low)}</span>
                        <span>Vol:</span>
                        <span>
                          {item.volume ? item.volume.toLocaleString('en-IN') : '—'}
                        </span>
                      </div>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth={1.8}
                fillOpacity={1}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

