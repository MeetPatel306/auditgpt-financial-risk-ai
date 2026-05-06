/**
 * Session route state cache.
 * Persists across refresh in same tab/session and resets when browser/tab session ends.
 */

const STORAGE_KEY = 'auditgpt_view_state_cache'

const defaults = {
  portfolioPage: {
    tags: [],
    result: null,
    error: null,
  },
  watchlistPage: {
    analysisResult: null,
    analysisError: null,
  },
}

function loadCache() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw)
    return {
      portfolioPage: { ...defaults.portfolioPage, ...(parsed.portfolioPage || {}) },
      watchlistPage: { ...defaults.watchlistPage, ...(parsed.watchlistPage || {}) },
    }
  } catch {
    return { ...defaults }
  }
}

function saveCache(cache) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage errors gracefully.
  }
}

const cache = loadCache()

export function getCachedState(key) {
  return cache[key] || null
}

export function setCachedState(key, partial) {
  if (!cache[key]) return
  cache[key] = { ...cache[key], ...partial }
  saveCache(cache)
}

export function clearCachedState(key) {
  if (!cache[key]) return
  cache[key] = { ...defaults[key] }
  saveCache(cache)
}
