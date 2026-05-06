import { useState } from 'react'
import { downloadPDFReport } from '../utils/pdfReport'

export default function DownloadReportButton({ data }) {
  const [state, setState] = useState('idle')   // idle | loading | done | error
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')

  async function handleDownload() {
    setState('loading')
    setProgress(0)
    setErr('')

    try {
      await downloadPDFReport(data, (pct) => setProgress(pct))
      setState('done')
      setTimeout(() => setState('idle'), 3000)
    } catch (e) {
      console.error('PDF error:', e)
      setErr(e?.message || 'PDF generation failed. Please try again.')
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  const isLoading = state === 'loading'
  const isDone    = state === 'done'
  const isError   = state === 'error'

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <button
        onClick={handleDownload}
        disabled={isLoading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          borderRadius: '9px',
          border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : isDone ? 'rgba(34,197,94,0.4)' : 'rgba(168,85,247,0.35)'}`,
          background: isError
            ? 'rgba(239,68,68,0.08)'
            : isDone
            ? 'rgba(34,197,94,0.08)'
            : 'rgba(168,85,247,0.08)',
          color: isError ? '#ef4444' : isDone ? '#22c55e' : '#a855f7',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          transition: 'all 0.2s ease',
          minWidth: '180px',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          opacity: isLoading ? 0.85 : 1,
        }}
        onMouseEnter={e => {
          if (!isLoading) {
            e.currentTarget.style.background = isError
              ? 'rgba(239,68,68,0.14)'
              : isDone
              ? 'rgba(34,197,94,0.14)'
              : 'rgba(168,85,247,0.14)'
            e.currentTarget.style.boxShadow = isError
              ? '0 0 18px rgba(239,68,68,0.12)'
              : isDone
              ? '0 0 18px rgba(34,197,94,0.12)'
              : '0 0 18px rgba(168,85,247,0.12)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isError
            ? 'rgba(239,68,68,0.08)'
            : isDone
            ? 'rgba(34,197,94,0.08)'
            : 'rgba(168,85,247,0.08)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {/* Progress fill bar */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${progress}%`,
            background: 'rgba(168,85,247,0.15)',
            transition: 'width 0.3s ease',
            borderRadius: '8px',
          }} />
        )}

        {/* Icon */}
        <span style={{ position: 'relative', zIndex: 1 }}>
          {isLoading ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3"/>
              <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : isDone ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : isError ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 4V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="7" cy="10" r="0.75" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v7m0 0L4.5 5.5M7 8l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 10v1.5A0.5 0.5 0 0 0 2.5 12h9a0.5 0.5 0 0 0 0.5-0.5V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          )}
        </span>

        {/* Label */}
        <span style={{ position: 'relative', zIndex: 1 }}>
          {isLoading
            ? `Generating… ${progress < 100 ? progress + '%' : ''}`
            : isDone
            ? '✓ Downloaded!'
            : isError
            ? 'Failed — Retry'
            : 'Download Report'}
        </span>
      </button>

      {isError && err && (
        <span style={{ color: '#ef4444', fontSize: '0.65rem', fontFamily: 'JetBrains Mono' }}>
          {err}
        </span>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
