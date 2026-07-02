import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '../platform/i18n/i18n'
import App from './App'
import { TRPCProvider } from './providers/TRPCProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TRPCProvider>
      <App />
    </TRPCProvider>
  </StrictMode>,
)
// Cache invalidation: 1780254455
