import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // Allow importing repo-root docs/ markdown into the web build.
      allow: [path.resolve(__dirname, '../../')],
    },
    proxy: apiProxy(),
  },
  // `vite preview` (serving the production build) uses the same proxy so the SPA
  // and the API share an origin (auth cookies work).
  preview: {
    proxy: apiProxy(),
  },
})

function apiProxy() {
  const target = process.env.VITE_API_PROXY ?? 'http://localhost:3001'
  return {
    '/api': { target, changeOrigin: true },
    '/ws': { target: target.replace(/^http/, 'ws'), ws: true },
  }
}
