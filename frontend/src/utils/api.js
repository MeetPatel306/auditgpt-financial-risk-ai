import { apiUrl } from './apiBase'

// Helper to handle responses
async function handleResponse(response, defaultMessage) {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail)
      ? err.detail[0].msg
      : (err.detail || defaultMessage)
    throw new Error(msg)
  }
  return response.json()
}

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
    body: JSON.stringify(analysisData),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = Array.isArray(err.detail)
      ? err.detail[0].msg
      : (err.detail || 'Report generation failed')
    throw new Error(msg)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let model = 'local'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value, { stream: true })
    const lines = text.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue

      const content = line.slice(6)

      if (content.startsWith('[DONE]|')) {
        model = content.slice(7)
        break
      }

      const chunk = content.replace(/\\n/g, '\n')
      onChunk(chunk)
    }
  }

  return model
}

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
}
