import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('auditgpt_token'))
  const [loading, setLoading] = useState(true)

  // On mount, validate existing token
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const userData = await getCurrentUser(token)
        setUser(userData)
      } catch {
        // Token is invalid or expired — clear it
        localStorage.removeItem('auditgpt_token')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    validateToken()
  }, [])

  function loginUser(tokenValue, userData) {
    localStorage.setItem('auditgpt_token', tokenValue)
    setToken(tokenValue)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('auditgpt_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
