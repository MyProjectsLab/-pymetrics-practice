import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Keep the new visual system out of every existing practice/game entry.
const { default: Entry } = window.location.pathname === '/'
  ? await import('./landing/Landing')
  : window.location.pathname === '/mock/report'
  ? await import('./mock/ReportEntry')
  : window.location.pathname === '/mock'
  ? await import('./mock/Dashboard')
  : await import('./App')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Entry />
  </StrictMode>,
)
