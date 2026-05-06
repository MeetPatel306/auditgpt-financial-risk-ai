import { useState, useEffect, useRef } from 'react'
import nseCompanies from '../data/nse_companies.json'

// Build search index from JSON
const NSE_COMPANIES = nseCompanies

function searchNSE(query, limit = 8) {
  const q = query.trim()
  if (!q || q.length < 2) return []
  const qUpper = q.toUpperCase()
  const qLower = q.toLowerCase()
  const results = []
  const seen = new Set()

  // Priority 1: Symbol starts with query
  for (const c of NSE_COMPANIES) {
    if (c.symbol.toUpperCase().startsWith(qUpper) && !seen.has(c.symbol)) {
      results.push(c); seen.add(c.symbol)
    }
  }
  // Priority 2: Name starts with query
  for (const c of NSE_COMPANIES) {
    if (c.name.toLowerCase().startsWith(qLower) && !seen.has(c.symbol)) {
      results.push(c); seen.add(c.symbol)
    }
  }
  // Priority 3: Name contains query
  for (const c of NSE_COMPANIES) {
    if (c.name.toLowerCase().includes(qLower) && !seen.has(c.symbol)) {
      results.push(c); seen.add(c.symbol)
    }
  }
  // Priority 4: Symbol contains query
  for (const c of NSE_COMPANIES) {
    if (c.symbol.toUpperCase().includes(qUpper) && !seen.has(c.symbol)) {
      results.push(c); seen.add(c.symbol)
    }
  }
  return results.slice(0, limit)
}

const NSE_SUGGESTIONS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Limited' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Limited' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Limited' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Limited' },
  { symbol: 'COALINDIA', name: 'Coal India Limited' },
  { symbol: 'WIPRO', name: 'Wipro Limited' },
]

export default function SearchBar({ value, onChange, onAnalyze, loading }) {
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const wrapperRef = useRef(null)
  const dropdownRef = useRef(null)

  // Update suggestions on input change
  useEffect(() => {
    const results = searchNSE(value)
    setSuggestions(results)
    setShowDropdown(results.length > 0 && value.trim().length >= 2)
    setSelectedIdx(-1)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectCompany(company) {
    onChange(company.name)
    setShowDropdown(false)
    onAnalyze(company.name)
  }

  function handleKey(e) {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(prev => Math.max(prev - 1, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (selectedIdx >= 0) {
          selectCompany(suggestions[selectedIdx])
        } else {
          setShowDropdown(false)
          onAnalyze(value)
        }
      } else if (e.key === 'Escape') {
        setShowDropdown(false)
      }
    } else if (e.key === 'Enter') {
      onAnalyze(value)
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIdx >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[selectedIdx]
      if (item) item.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIdx])

  return (
    <div className="w-full" ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', gap: '12px', alignItems: 'stretch',
        background: 'var(--bg-card)',
        border: `1px solid ${focused ? 'var(--accent-cyan)' : 'var(--border)'}`,
        borderRadius: showDropdown ? '12px 12px 0 0' : '12px',
        padding: '6px 6px 6px 16px',
        boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>
        {/* Search icon */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="var(--text-muted)" strokeWidth="1.5"/>
            <path d="M13 13L16 16" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        <input
          id="company-search-input"
          className="search-input flex-1"
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '1rem',
            padding: '10px 8px',
            width: '100%',
          }}
          placeholder="Enter NSE company name or symbol (e.g. RELIANCE, TCS, Wipro...)"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { setFocused(true); if (suggestions.length > 0 && value.trim().length >= 2) setShowDropdown(true) }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          disabled={loading}
          autoComplete="off"
        />

        <button
          id="analyze-button"
          className="btn-primary"
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => { setShowDropdown(false); onAnalyze(value) }}
          disabled={loading || !value.trim()}
        >
          {loading ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 0.8s linear infinite' }}>
                <circle cx="8" cy="8" r="6" stroke="rgba(0,0,0,0.3)" strokeWidth="2" fill="none"/>
                <path d="M8 2A6 6 0 0 1 14 8" stroke="#020a12" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
              ANALYZING
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L9.5 5.5H13L9.75 8.5L11 13L7 10.5L3 13L4.25 8.5L1 5.5H4.5L7 1Z" 
                  fill="currentColor"/>
              </svg>
              ANALYZE
            </>
          )}
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="nse-dropdown"
        >
          {suggestions.map((c, i) => (
            <button
              key={c.symbol}
              className={`nse-dropdown-item ${i === selectedIdx ? 'nse-dropdown-item-active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectCompany(c) }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span className="nse-symbol">{c.symbol}</span>
              <span className="nse-name">{c.name}</span>
            </button>
          ))}
          <div className="nse-dropdown-footer">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
              <path d="M6 4V7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <circle cx="6" cy="8.5" r="0.5" fill="currentColor"/>
            </svg>
            NSE Listed Companies • {NSE_COMPANIES.length} total
          </div>
        </div>
      )}

      {/* Quick suggestions */}
      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', alignSelf: 'center', fontFamily: 'JetBrains Mono' }}>
          NSE:
        </span>
        {NSE_SUGGESTIONS.map(s => (
          <button key={s.symbol}
            onClick={() => { onChange(s.name); setShowDropdown(false); onAnalyze(s.name) }}
            disabled={loading}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: '0.75rem',
              padding: '3px 10px', borderRadius: '20px', cursor: 'pointer',
              transition: 'all 0.15s', fontFamily: 'Inter',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--accent-cyan)'; e.target.style.color = 'var(--accent-cyan)' }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-secondary)' }}
          >{s.symbol}</button>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )
}
