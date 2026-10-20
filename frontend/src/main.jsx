import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerNotificationServiceWorker } from './components/desktopNotifications.js'

window.__nodeBeaconNotificationRegistrationPromise = registerNotificationServiceWorker(window.navigator)
  .catch(error => {
    console.error('[DesktopNotification] Service worker registration failed:', error)
    return null
  })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
