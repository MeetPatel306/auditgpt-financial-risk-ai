import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass(req) {
          // Let the React app handle the OAuth redirect page.
          if (req.url && req.url.startsWith('/auth/google/callback')) {
            return '/index.html'
          }
        },
      }
    }
  },
})
