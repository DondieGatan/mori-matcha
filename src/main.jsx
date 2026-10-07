import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import AdminPage from './pages/AdminPage.jsx'
import PartyCartPage from './pages/PartyCartPage.jsx'
import './styles/style.css'

const path = window.location.pathname.replace(/\/+$/, '')
const isAdmin = path === '/admin'
const isPartyCart = path === '/party-cart'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdmin ? <AdminPage /> : isPartyCart ? <PartyCartPage /> : <App />}
    <Analytics />
  </StrictMode>,
)
