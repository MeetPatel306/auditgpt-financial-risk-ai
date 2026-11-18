<<<<<<< HEAD
const rawApiBase = import.meta.env.VITE_API_URL
// Prefer explicit env var; otherwise use same-origin in dev/prod so Vite proxy can handle API routing.
const API_BASE = (rawApiBase && rawApiBase.trim())
  ? rawApiBase.replace(/\/+$/, '')
  : ''

function mapValidationMessage(item) {
  const loc = Array.isArray(item?.loc) ? item.loc.join('.') : ''
  const msg = item?.msg || item?.message || ''
  if (/email/i.test(loc) || /email/i.test(msg)) {
    return 'Please enter a valid email address.'
  }
  if (/password/i.test(loc) || /password/i.test(msg)) {
    return 'Password does not meet the requirements.'
  }
  if (/name/i.test(loc)) {
    return 'Full name is required.'
  }
  return msg || null
}

export function parseApiError(errBody, fallback) {
  if (Array.isArray(errBody?.detail) && errBody.detail.length > 0) {
    return mapValidationMessage(errBody.detail[0]) || fallback
  }
  if (typeof errBody?.detail === 'string' && errBody.detail.trim()) {
    return errBody.detail
  }
  return fallback
}

async function readErrorMessage(response, fallback) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return 'Authentication service is temporarily unavailable.'
  }
  const err = await response.json().catch(() => ({}))
  return parseApiError(err, fallback)
}

async function authRequest(path, options, fallback) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    })
  } catch {
    throw new Error('Authentication service is temporarily unavailable.')
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallback))
  }
  return response.json()
}

export async function analyzeCompany(companyName) {
  const token = localStorage.getItem('auditgpt_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE}/api/analyze-company`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ company_name: companyName }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Analysis failed')
=======
import { apiUrl } from './apiBase'

// Helper to handle responses
async function handleResponse(response, defaultMessage) {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail)
      ? err.detail[0].msg
      : (err.detail || defaultMessage)
>>>>>>> origin/main
    throw new Error(msg)
  }
  return response.json()
}

<<<<<<< HEAD
export async function signupUserApi(name, email, password) {
  return authRequest(
    '/auth/signup',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    },
    'Unable to create account. Please try again.',
  )
}

export async function loginUserApi(email, password) {
  return authRequest(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'Unable to sign in. Please try again.',
  )
}

/**
 * Send a verified Google ID token (obtained from Google Identity Services)
 * to the backend for server-side verification and application JWT issuance.
 *
 * @param {string} idToken - The JWT ID token from Google Identity Services
 */
export async function googleIdTokenAuthApi(idToken) {
  return authRequest(
    '/auth/google',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    },
    'Google authentication could not be verified.',
  )
}

/**
 * Send the Google OAuth authorization code to the backend for secure exchange.
 * The backend will exchange the code for tokens and verify the ID token
 * using the Google Client Secret — which is NEVER exposed to the browser.
 *
 * @param {string} code         – authorization code from Google
 * @param {string} redirectUri  – must match the redirect URI registered in Google Cloud Console
 */
export async function googleAuthApi(code, redirectUri) {
  return authRequest(
    '/auth/google',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    },
    'Google authentication could not be verified.',
  )
}


export async function getCurrentUser(token) {
  let response
  try {
    response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error('Authentication service is temporarily unavailable.')
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('Token validation failed')
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Authentication service is temporarily unavailable.'))
  }
  return response.json()
}

export async function analyzePortfolio(companies) {
  const token = localStorage.getItem('auditgpt_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE}/api/analyze-portfolio`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ companies }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Portfolio analysis failed')
    throw new Error(msg)
  }
  return response.json()
}

/**
 * Generate an AI report (streaming SSE).
 * @param {object} analysisData  – full analysis payload from /analyze-company
 * @param {function} onChunk     – called with each text chunk string
 * @returns {Promise<string>}    – resolves with the model name ("gpt-4o-mini" | "local")
 */
export async function generateReportStream(analysisData, onChunk) {
  const token = localStorage.getItem('auditgpt_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE}/api/generate-report/stream`, {
    method: 'POST',
    headers,
=======
// Helper to get auth headers
function getAuthHeaders(includeContentType = true) {
  const token = localStorage.getItem('auditgpt_token')
  const headers = {}

  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

/* ───────────────────────── AUTH ───────────────────────── */

export async function signupUserApi(name, email, password) {
  const response = await fetch(apiUrl('/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })

  return handleResponse(response, 'Signup failed')
}

export async function loginUserApi(email, password) {
  const response = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  return handleResponse(response, 'Login failed')
}

export async function getCurrentUser(token) {
  const response = await fetch(apiUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  })

  return handleResponse(response, 'Token validation failed')
}

/* ───────────────────────── ANALYSIS ───────────────────────── */

export async function analyzeCompany(companyName) {
  const response = await fetch(apiUrl('/api/analyze-company'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ company_name: companyName }),
  })

  return handleResponse(response, 'Analysis failed')
}

export async function analyzePortfolio(companies) {
  const response = await fetch(apiUrl('/api/analyze-portfolio'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ companies }),
  })

  return handleResponse(response, 'Portfolio analysis failed')
}

/* ───────────────────────── REPORT STREAM ───────────────────────── */

export async function generateReportStream(analysisData, onChunk) {
  const response = await fetch(apiUrl('/api/generate-report/stream'), {
    method: 'POST',
    headers: getAuthHeaders(),
>>>>>>> origin/main
    body: JSON.stringify(analysisData),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
<<<<<<< HEAD
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Report generation failed')
=======
    const msg = Array.isArray(err.detail)
      ? err.detail[0].msg
      : (err.detail || 'Report generation failed')
>>>>>>> origin/main
    throw new Error(msg)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let model = 'local'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value, { stream: true })
<<<<<<< HEAD
    // SSE lines: "data: <content>\n\n"
    const lines = text.split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const content = line.slice(6)
=======
    const lines = text.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue

      const content = line.slice(6)

>>>>>>> origin/main
      if (content.startsWith('[DONE]|')) {
        model = content.slice(7)
        break
      }
<<<<<<< HEAD
      // Restore newlines escaped for SSE
=======

>>>>>>> origin/main
      const chunk = content.replace(/\\n/g, '\n')
      onChunk(chunk)
    }
  }

  return model
}

<<<<<<< HEAD
export async function getHistory(token) {
  const response = await fetch(`${API_BASE}/api/history`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Failed to fetch history')
    throw new Error(msg)
  }
  return response.json()
}

export async function getHistoryDetail(token, id) {
  const response = await fetch(`${API_BASE}/api/history/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Failed to fetch analysis detail')
    throw new Error(msg)
  }
  return response.json()
}

export async function deleteHistory(token, id) {
  const response = await fetch(`${API_BASE}/api/history/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Failed to delete record')
    throw new Error(msg)
  }
  return response.json()
}

/* ── Saved Portfolio APIs ──────────────────────────────────────── */

export async function getSavedPortfolio(token) {
  const response = await fetch(`${API_BASE}/api/portfolio`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Failed to fetch portfolio')
    throw new Error(msg)
  }
  return response.json()
}

export async function addToPortfolio(token, symbols) {
  const response = await fetch(`${API_BASE}/api/portfolio/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ symbols }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Failed to add to portfolio')
    throw new Error(msg)
  }
  return response.json()
}

export async function removeFromPortfolio(token, symbol) {
  const response = await fetch(`${API_BASE}/api/portfolio/remove`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ symbol }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Failed to remove from portfolio')
    throw new Error(msg)
  }
  return response.json()
}

export async function getAlertEmailConfig() {
  const response = await fetch(`${API_BASE}/api/alert-config`)
  if (!response.ok) {
    throw new Error('Failed to fetch alert config status')
  }
  return response.json()
}

export async function sendAlertEmail(payload) {
  const token = localStorage.getItem('auditgpt_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(`${API_BASE}/api/send-alert`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Failed to send alert email')
    throw new Error(msg)
  }
  return response.json()
}

export async function getLivePrice(symbol) {
  if (!symbol) throw new Error('Symbol is required')
  const response = await fetch(`${API_BASE}/api/live-price/${encodeURIComponent(symbol.trim().toUpperCase())}`)
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || `Failed to fetch price for ${symbol}`)
    throw new Error(msg)
  }
  return response.json()
}

export async function getBatchLivePrices(symbols) {
  if (!symbols || symbols.length === 0) return { results: {}, market_status: null }
  const symQuery = symbols.map(s => encodeURIComponent(s.trim().toUpperCase())).join(',')
  const response = await fetch(`${API_BASE}/api/live-price/batch?symbols=${symQuery}`)
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Failed to fetch batch prices')
    throw new Error(msg)
  }
  return response.json()
}

export async function getMarketStatus() {
  const response = await fetch(`${API_BASE}/api/market-status`)
  if (!response.ok) {
    throw new Error('Failed to fetch market status')
  }
  return response.json()
}

/* ── Historical Market Data APIs (up to 10 years) ─────────────── */

export async function getHistoricalPrices(symbol, period = '10y') {
  if (!symbol) throw new Error('Symbol is required')
  const sym = encodeURIComponent(symbol.trim().toUpperCase())
  const p = encodeURIComponent(period.toLowerCase())
  const response = await fetch(`${API_BASE}/api/market-data/${sym}/history?period=${p}`)
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || `Failed to fetch history for ${symbol}`)
    throw new Error(msg)
  }
  return response.json()
}

export async function syncHistoricalPrices(symbol) {
  if (!symbol) throw new Error('Symbol is required')
  const token = localStorage.getItem('auditgpt_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const sym = encodeURIComponent(symbol.trim().toUpperCase())
  const response = await fetch(`${API_BASE}/api/market-data/sync/${sym}`, {
    method: 'POST',
    headers,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || `Sync failed for ${symbol}`)
    throw new Error(msg)
  }
  return response.json()
}

export async function getSyncStatus() {
  const response = await fetch(`${API_BASE}/api/market-data/sync-status`)
  if (!response.ok) {
    throw new Error('Failed to fetch sync status')
  }
  return response.json()
=======
/* ───────────────────────── HISTORY ───────────────────────── */

export async function getHistory(token) {
  const response = await fetch(apiUrl('/api/history'), {
    headers: { Authorization: `Bearer ${token}` },
  })

  return handleResponse(response, 'Failed to fetch history')
}

export async function getHistoryDetail(token, id) {
  const response = await fetch(apiUrl(`/api/history/${id}`), {
    headers: { Authorization: `Bearer ${token}` },
  })

  return handleResponse(response, 'Failed to fetch analysis detail')
}

export async function deleteHistory(token, id) {
  const response = await fetch(apiUrl(`/api/history/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  return handleResponse(response, 'Failed to delete record')
}

/* ───────────────────────── PORTFOLIO ───────────────────────── */

export async function getSavedPortfolio(token) {
  const response = await fetch(apiUrl('/api/portfolio'), {
    headers: { Authorization: `Bearer ${token}` },
  })

  return handleResponse(response, 'Failed to fetch portfolio')
}

export async function addToPortfolio(token, symbols) {
  const response = await fetch(apiUrl('/api/portfolio/add'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbols }),
  })

  return handleResponse(response, 'Failed to add to portfolio')
}

export async function removeFromPortfolio(token, symbol) {
  const response = await fetch(apiUrl('/api/portfolio/remove'), {
    method: 'DELETE',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbol }),
  })

  return handleResponse(response, 'Failed to remove from portfolio')
}

/* ───────────────────────── ALERTS ───────────────────────── */

export async function getAlertEmailConfig() {
  const response = await fetch(apiUrl('/api/alert-config'))
  return handleResponse(response, 'Failed to fetch alert config')
}

export async function sendAlertEmail(payload) {
  const response = await fetch(apiUrl('/api/send-alert'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  return handleResponse(response, 'Failed to send alert email')
>>>>>>> origin/main
}
