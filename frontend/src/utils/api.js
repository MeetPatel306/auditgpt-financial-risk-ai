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
    throw new Error(msg)
  }
  return response.json()
}

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
    body: JSON.stringify(analysisData),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : (err.detail || 'Report generation failed')
    throw new Error(msg)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let model = 'local'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value, { stream: true })
    // SSE lines: "data: <content>\n\n"
    const lines = text.split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const content = line.slice(6)
      if (content.startsWith('[DONE]|')) {
        model = content.slice(7)
        break
      }
      // Restore newlines escaped for SSE
      const chunk = content.replace(/\\n/g, '\n')
      onChunk(chunk)
    }
  }

  return model
}

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
