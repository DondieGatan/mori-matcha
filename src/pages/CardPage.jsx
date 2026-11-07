import { useCallback, useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import BackToTop from '../components/BackToTop'
import Assistant from '../components/Assistant'
import { LoyaltyCardBack, LoyaltyCardFront } from '../components/LoyaltyCardArt'
import { INSTAGRAM_DM_URL } from '../data/menu'
import { CARD_SLOTS, REWARD_TEXT, STAMPS_PER_REWARD } from '../data/loyalty'

const TOKEN_KEY = 'mori-card-token'
const NUMBER_KEY = 'mori-card-number'
const SEEN_KEY = 'mori-card-seen'

function readStore(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}
function writeStore(key, value) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // storage unavailable (private mode): the link in the address bar still works
  }
}

// The card link looks like /card#<secret>. The secret sits after the # on purpose: browsers never send that part to the
// server, to other sites in the Referer header, or into the address that analytics record.
function tokenFromUrl() {
  const raw = window.location.hash.slice(1)
  try {
    return decodeURIComponent(raw).trim()
  } catch {
    return ''
  }
}

const KIND_TEXT = {
  stamp: (n) => `${n} stamp${n === 1 ? '' : 's'} added`,
  redeem: () => 'Free drink enjoyed',
  void: (n) => (n > 0 ? 'Free drink put back' : 'A stamp was corrected'),
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' })
  } catch {
    return ''
  }
}

export default function CardPage() {
  const [token, setToken] = useState(() => tokenFromUrl() || readStore(TOKEN_KEY))
  const [state, setState] = useState(token ? 'loading' : 'none') // loading | ready | notfound | busy | error | none
  const [card, setCard] = useState(null)
  const [freshFrom, setFreshFrom] = useState(null)
  const lastBalance = useRef(null)

  const load = useCallback(
    async (quiet = false) => {
      if (!token) return
      if (!quiet) setState('loading')
      try {
        const res = await fetch('/api/loyalty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'view', token }),
        })
        if (res.status === 404) {
          writeStore(TOKEN_KEY, '')
          writeStore(NUMBER_KEY, '')
          setState('notfound')
          return
        }
        if (res.status === 429) {
          setState('busy')
          return
        }
        if (!res.ok) throw new Error('bad status')
        const data = await res.json()
        const seen = Number(readStore(SEEN_KEY + ':' + data.card.cardNumber))
        const fresh = Number.isFinite(seen) && readStore(SEEN_KEY + ':' + data.card.cardNumber) !== '' && data.card.balance > seen ? seen : null
        // A second look at the same balance (for example the tab being switched to right after it opened) must not cut
        // short the stamps that are still coming down.
        setFreshFrom((prev) => (fresh !== null ? fresh : lastBalance.current === data.card.balance ? prev : null))
        lastBalance.current = data.card.balance
        writeStore(SEEN_KEY + ':' + data.card.cardNumber, String(data.card.balance))
        writeStore(TOKEN_KEY, token)
        writeStore(NUMBER_KEY, data.card.cardNumber)
        setCard(data.card)
        setState('ready')
      } catch {
        setState((s) => (s === 'ready' ? s : 'error'))
      }
    },
    [token],
  )

  useEffect(() => {
    document.title = 'My Loyalty Card — Mori Matcha'
    // A private page: keep it out of search results and never leak its address to other sites.
    const tags = [
      ['robots', 'noindex, nofollow'],
      ['referrer', 'no-referrer'],
    ].map(([name, content]) => {
      const m = document.createElement('meta')
      m.name = name
      m.content = content
      document.head.appendChild(m)
      return m
    })
    window.scrollTo(0, 0)
    return () => tags.forEach((m) => m.remove())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Opening a different card link while this page is already open (for example from a message) switches to that card.
  useEffect(() => {
    const onHash = () => {
      const next = tokenFromUrl()
      if (next && next !== token) {
        lastBalance.current = null
        setFreshFrom(null)
        setCard(null)
        setToken(next)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [token])

  // New stamps appear without a reload when the customer comes back to the tab.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && load(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const balance = card ? card.balance : 0
  const ready = balance >= STAMPS_PER_REWARD
  const toGo = Math.max(0, STAMPS_PER_REWARD - balance)
  const carried = ready ? balance - STAMPS_PER_REWARD : 0

  return (
    <>
      <Header onPartyPage />
      <main id="top" className="loyalty-page">
        <section className="section">
          <div className="section-inner loyalty-inner">
            <p className="eyebrow center">Loyalty Card</p>
            <h1 className="section-title center">Your Mori Matcha Card</h1>

            {state === 'loading' && <p className="loyalty-note center" role="status">Loading your card…</p>}

            {(state === 'none' || state === 'notfound') && (
              <div className="loyalty-empty-state">
                <p>
                  {state === 'notfound'
                    ? "We couldn't find a card for this link. It may have been replaced. Message us on Instagram and we'll send you the right one."
                    : `Collect ${STAMPS_PER_REWARD} stamps and your ${CARD_SLOTS}th drink is free. Ask us for your card the next time you order, and we'll send you a private link to keep it on your phone.`}
                </p>
                <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-primary">
                  Ask for my card on Instagram
                </a>
              </div>
            )}

            {state === 'busy' && <p className="loyalty-note center">Lots of people are looking right now. Please try again in a few minutes.</p>}
            {state === 'error' && (
              <div className="loyalty-empty-state">
                <p>We couldn&apos;t reach the server. Check your connection and try again.</p>
                <button type="button" className="btn btn-primary" onClick={() => load()}>
                  Try again
                </button>
              </div>
            )}

            {state === 'ready' && card && (
              <>
                <div className="loyalty-cards">
                  <LoyaltyCardFront label={card.label} cardNumber={card.cardNumber} />
                  <LoyaltyCardBack balance={balance} freshFrom={freshFrom} />
                </div>

                <div className={'loyalty-status' + (ready ? ' is-ready' : '')} role="status">
                  {ready ? (
                    <>
                      <strong>Your free drink is ready!</strong>
                      <span>
                        Tell us your card number <b>{card.cardNumber}</b> when you order and we&apos;ll give you {REWARD_TEXT}.
                        {carried > 0 && ` ${carried} extra stamp${carried === 1 ? ' is' : 's are'} saved for your next card.`}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>
                        {balance} of {STAMPS_PER_REWARD} stamps
                      </strong>
                      <span>
                        {toGo} more drink{toGo === 1 ? '' : 's'} until your free one. Quote card <b>{card.cardNumber}</b> when you order so we can stamp it.
                      </span>
                    </>
                  )}
                </div>

                {card.rewardsRedeemed > 0 && (
                  <p className="loyalty-note center">
                    Free drinks enjoyed so far: <b>{card.rewardsRedeemed}</b>
                  </p>
                )}

                {card.history.length > 0 && (
                  <div className="loyalty-history">
                    <h2>Recent activity</h2>
                    <ul>
                      {card.history.map((h, i) => (
                        <li key={i}>
                          <span>{(KIND_TEXT[h.kind] || (() => ''))(Math.abs(h.stamps))}</span>
                          <time>{formatWhen(h.at)}</time>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="loyalty-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => load(true)}>
                    Refresh
                  </button>
                  <a href="/#menu" className="btn btn-primary">
                    Order a drink
                  </a>
                </div>
                <p className="loyalty-note center loyalty-private">
                  This link is yours alone. Anyone who has it can see your card, so please don&apos;t share it. Stamps can only be added by our team.
                </p>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <BackToTop />
      <Assistant />
    </>
  )
}
