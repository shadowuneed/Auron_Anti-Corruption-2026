import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        timeout: 120000,        // 2 minutes — Gemini AI can be slow
        proxyTimeout: 120000,
      },
    },
  },
})
