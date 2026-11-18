import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import Dashboard from './pages/Dashboard'
import PortfolioPage from './pages/PortfolioPage'
import SavedPortfolioPage from './pages/SavedPortfolioPage'
import HistoryPage from './pages/HistoryPage'
<<<<<<< HEAD
import GoogleCallbackPage from './pages/GoogleCallbackPage'
=======
>>>>>>> origin/main

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
<<<<<<< HEAD
        {/* Google OAuth 2.0 redirect target – must be public */}
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
=======
>>>>>>> origin/main
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <PortfolioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/watchlist"
          element={
            <ProtectedRoute>
              <SavedPortfolioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
