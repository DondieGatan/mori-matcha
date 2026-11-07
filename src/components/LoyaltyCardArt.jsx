import { CARD_SLOTS, STAMPS_PER_REWARD } from '../data/loyalty'

// The digital loyalty card: a green front and a cream back with the stamp slots. Pure display; the stamps themselves live
// on the server and are added by the café team, so nothing on this card can be edited from the browser.

// A hand-stamped seal: a green round stamp with a matcha leaf. Each one is turned a little differently.
function Seal({ index, fresh }) {
  const tilt = ((index * 37) % 15) - 7
  return (
    <svg viewBox="0 0 64 64" className={'loyalty-seal' + (fresh ? ' is-fresh' : '')} style={{ transform: `rotate(${tilt}deg)`, animationDelay: fresh ? fresh * 160 + 'ms' : undefined }} aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="#2d4433" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="#ece1c8" strokeWidth="1.2" opacity="0.55" strokeDasharray="2 3" />
      <path d="M32 47c-12-5-15-19 0-31 15 12 12 26 0 31z" fill="#b5cf82" />
      <path d="M32 45V23" stroke="#2d4433" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M32 33l-6-5M32 38l7-6" stroke="#2d4433" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function EmptySlot({ number }) {
  return (
    <svg viewBox="0 0 64 64" className="loyalty-empty" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3.5 4.5" />
      <text x="32" y="38" textAnchor="middle" fontSize="18" fill="currentColor" fontFamily="Cormorant Garamond, serif">
        {number}
      </text>
    </svg>
  )
}

// The last slot: an iced matcha with a FREE flag. It lights up when a reward is ready.
function FreeSlot({ ready }) {
  return (
    <div className={'loyalty-free' + (ready ? ' is-ready' : '')}>
      <svg viewBox="0 0 64 80" aria-hidden="true">
        <path d="M44 4l-4 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 26h36l-4 46a5 5 0 0 1-5 4H23a5 5 0 0 1-5-4z" fill="#fffaf0" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M16.2 44h31.6l-2.4 28a5 5 0 0 1-5 4H23.6a5 5 0 0 1-5-4z" fill={ready ? '#7fa04f' : '#b9c4a6'} />
        <path d="M12 26h40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="26" cy="56" r="3" fill="#fffaf0" opacity="0.7" />
        <circle cx="38" cy="62" r="2.4" fill="#fffaf0" opacity="0.7" />
      </svg>
      <span className="loyalty-free-flag">FREE</span>
    </div>
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

// `balance` is the number of stamps on the card. `freshFrom` is the balance the customer last saw, so new stamps can animate in.
export function LoyaltyCardBack({ balance = 0, freshFrom = null }) {
  const ready = balance >= STAMPS_PER_REWARD
  const filled = ready ? STAMPS_PER_REWARD : balance
  const slots = []
  for (let i = 0; i < STAMPS_PER_REWARD; i++) {
    const isFilled = i < filled
    const fresh = isFilled && freshFrom !== null && i >= Math.min(freshFrom, STAMPS_PER_REWARD) ? i - Math.min(freshFrom, STAMPS_PER_REWARD) + 1 : 0
    slots.push(
      <li key={i} className={'loyalty-slot' + (isFilled ? ' is-filled' : '')}>
        {isFilled ? <Seal index={i} fresh={fresh} /> : <EmptySlot number={i + 1} />}
        <span className="sr-only">{isFilled ? `Stamp ${i + 1}, collected` : `Stamp ${i + 1}, not yet collected`}</span>
      </li>,
    )
  }
  return (
    <div className="loyalty-back">
      <p className="loyalty-back-title">
        Collect {STAMPS_PER_REWARD} stamps,
        <br />
        your {CARD_SLOTS}th drink is on us.
      </p>
      <ol className="loyalty-slots" aria-label={`${filled} of ${STAMPS_PER_REWARD} stamps collected`}>
        {slots}
        <li className="loyalty-slot loyalty-slot-free">
          <FreeSlot ready={ready} />
          <span className="sr-only">{ready ? 'Your free drink is ready' : 'Free drink, unlocked at ' + STAMPS_PER_REWARD + ' stamps'}</span>
        </li>
      </ol>
      <p className="loyalty-back-fine">One stamp per drink, added by our team once your order is paid.</p>
    </div>
  )
}
