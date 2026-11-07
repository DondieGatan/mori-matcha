import { useEffect, useRef, useState } from 'react'
import { STAMPS_PER_REWARD } from '../data/loyalty'

// The digital loyalty card: a green front and the stamp card. Pure display; the stamps themselves live on the server and
// are added by the café team, so nothing on this card can be edited from the browser.

// The stamp card is Mori's own artwork (a flat picture with ten round seals, the last one marked Free). Each collected
// stamp is a matcha-bowl stamp that is pressed down onto its seal. The positions below are the seal centres measured on
// the artwork (1280 x 908 pixels), so the stamps line up at any card size.
const ART_W = 1280
const ART_H = 908
const SEAL = 180
const COLS = [190, 408.75, 627.5, 846.25, 1065]
const ROWS = [452, 655]

const slotStyle = (i) => ({
  left: ((COLS[i % 5] - SEAL / 2) / ART_W) * 100 + '%',
  top: ((ROWS[Math.floor(i / 5)] - SEAL / 2) / ART_H) * 100 + '%',
  width: (SEAL / ART_W) * 100 + '%',
})

const FIRST_DELAY = 280 // ms before the first stamp comes down
const STAMP_GAP = 330 // ms between stamps that come down one after another

// One matcha-bowl stamp. Every stamp is pressed on at a slightly different angle, like a real hand stamp.
function Stamp({ index, animate }) {
  const tilt = ((index * 37) % 17) - 8
  return (
    <>
      <span className={'loyalty-stamp' + (animate ? ' is-fresh' : '')} style={{ '--tilt': tilt + 'deg' }} aria-hidden="true">
        <img src="/loyalty/stamp.webp" alt="" width="312" height="269" draggable="false" decoding="async" />
      </span>
      {animate && <span className="loyalty-ink is-fresh" aria-hidden="true" />}
    </>
  )
}

export function LoyaltyCardFront({ label, cardNumber }) {
  return (
    <div className="loyalty-front" role="img" aria-label={`Mori Matcha loyalty card${label ? ' for ' + label : ''}`}>
      <svg className="loyalty-front-leaf" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M100 190C40 160 20 90 100 20c80 70 60 140 0 170z" fill="none" stroke="#ece1c8" strokeWidth="1.5" opacity="0.18" />
        <path d="M100 185V40M100 110l-34-30M100 140l40-36" stroke="#ece1c8" strokeWidth="1.2" opacity="0.18" strokeLinecap="round" />
      </svg>
      <p className="loyalty-front-top">LOYALTY CARD</p>
      <p className="loyalty-front-brand">
        MORI <span>Matcha</span>
      </p>
      <p className="loyalty-front-tag">Freshly whisked &middot; Made to order</p>
      <div className="loyalty-front-foot">
        <span>{label || 'Your name'}</span>
        <span>{cardNumber || 'LC-····'}</span>
      </div>
    </div>
  )
}

// `balance` is the number of stamps on the card. `freshFrom` is the balance the customer last saw, so only the new stamps
// come down. `autoplay` is for the example card on the home page: it stays blank until it scrolls into view, then every
// stamp comes down in turn. Tapping a collected stamp plays it again.
export function LoyaltyCardBack({ balance = 0, freshFrom = null, autoplay = false }) {
  const ready = balance >= STAMPS_PER_REWARD
  const filled = ready ? STAMPS_PER_REWARD : balance
  const sheet = useRef(null)
  const [visible, setVisible] = useState(!autoplay)
  const [replays, setReplays] = useState({})

  useEffect(() => {
    if (!autoplay || visible) return undefined
    if (typeof IntersectionObserver === 'undefined' || !sheet.current) {
      setVisible(true)
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.45 },
    )
    io.observe(sheet.current)
    return () => io.disconnect()
  }, [autoplay, visible])

  const seen = autoplay ? 0 : freshFrom === null ? filled : Math.min(freshFrom, STAMPS_PER_REWARD)
  const slots = []
  for (let i = 0; i < STAMPS_PER_REWARD; i++) {
    const isFilled = i < filled && visible
    const replay = replays[i]
    const isNew = isFilled && i >= seen
    const delay = replay ? 0 : isNew ? FIRST_DELAY + (i - seen) * STAMP_GAP : 0
    slots.push(
      <li
        key={i}
        className={'loyalty-slot' + (isFilled ? ' is-filled' : '')}
        style={{ ...slotStyle(i), '--delay': delay + 'ms' }}
        onClick={isFilled ? () => setReplays((r) => ({ ...r, [i]: (r[i] || 0) + 1 })) : undefined}
      >
        {isFilled && <Stamp key={replay || 0} index={i} animate={isNew || Boolean(replay)} />}
        <span className="sr-only">{i < filled ? `Stamp ${i + 1}, collected` : `Stamp ${i + 1}, not yet collected`}</span>
      </li>,
    )
  }

  return (
    <div className="loyalty-back">
      <div className="loyalty-sheet" ref={sheet}>
        <img className="loyalty-sheet-bg" src="/loyalty/card-design.webp" alt="" width="1080" height="766" draggable="false" decoding="async" />
        <ol className="loyalty-slots" aria-label={`${filled} of ${STAMPS_PER_REWARD} stamps collected`}>
          {slots}
          <li className={'loyalty-slot loyalty-slot-free' + (ready ? ' is-ready' : '')} style={slotStyle(STAMPS_PER_REWARD)}>
            <span className="sr-only">{ready ? 'Your free drink is ready' : 'Free drink, unlocked at ' + STAMPS_PER_REWARD + ' stamps'}</span>
          </li>
        </ol>
      </div>
      <p className="loyalty-back-fine">One stamp per drink, added by our team once your order is paid. Tap a stamp to see it again.</p>
    </div>
  )
}
