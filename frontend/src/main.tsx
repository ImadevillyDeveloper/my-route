import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// In-app browsers (e.g. Telegram's) sometimes don't recompute CSS dvh/svh
// units when their own chrome collapses/expands, leaving fixed-height
// screens (the map) stale relative to the real touchable viewport. Track
// the real height via JS as a fallback, kept in sync on every resize.
const setAppVh = () => {
  document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`)
}
setAppVh()
window.addEventListener('resize', setAppVh)
window.addEventListener('orientationchange', setAppVh)
window.visualViewport?.addEventListener('resize', setAppVh)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
