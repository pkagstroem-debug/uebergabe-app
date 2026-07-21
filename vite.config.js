import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Yahoo-Finance-Proxy: umgeht CORS im lokalen Betrieb (npm run dev / npm run preview).
// Für statisches Hosting ohne Proxy kann in den Einstellungen der App ein
// eigener CORS-Proxy-Prefix hinterlegt werden.
const yahooProxy = {
  '/yahoo': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/yahoo/, ''),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
  },
  server: { proxy: yahooProxy },
  preview: { proxy: yahooProxy },
})
