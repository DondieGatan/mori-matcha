import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import AdminPage from './pages/AdminPage.jsx'
import PartyCartPage from './pages/PartyCartPage.jsx'
import CardPage from './pages/CardPage.jsx'
import './styles/style.css'

const path = window.location.pathname.replace(/\/+$/, '')
const isAdmin = path === '/admin'
const isPartyCart = path === '/party-cart' || path === '/party-cart.html'
const isCard = path === '/card'

// A card link keeps its secret after the #. Analytics must never record it, so every event is sent without the fragment.
const stripFragment = (event) => ({ ...event, url: event.url.split('#')[0] })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdmin ? <AdminPage /> : isCard ? <CardPage /> : isPartyCart ? <PartyCartPage /> : <App />}
    <Analytics beforeSend={stripFragment} />
  </StrictMode>,
)
