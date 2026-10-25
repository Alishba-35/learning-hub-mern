import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // /api ki saari requests Express server (port 5000) ko jati hain.
    // Is se browser ko lagta hai sab kuch ek hi jagah se aa raha hai (cookies bhi theek chalti hain).
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  test: {
    environment: 'jsdom',
  },
})
