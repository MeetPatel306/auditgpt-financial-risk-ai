function getApiRoot() {
  const rawApiBase = import.meta.env.VITE_API_URL
  return rawApiBase?.trim()
    ? rawApiBase.trim().replace(/\/+$/, '')
    : (import.meta.env.DEV ? 'http://localhost:8000' : '')
}

export const API_ROOT = getApiRoot()

export function apiUrl(path) {
  const root = getApiRoot()

  if (!root && import.meta.env.PROD) {
    throw new Error(
      'Backend API URL is not configured. Set VITE_API_URL to your deployed backend URL.'
    )
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${root}${normalizedPath}`
}
