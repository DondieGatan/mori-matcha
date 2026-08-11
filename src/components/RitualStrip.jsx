import { useRef, useState } from 'react'

const RITUALS = [
  { kind: 'whisk', label: 'whisk', caption: 'Freshly Prepared', animClass: 'is-whisking' },
  { kind: 'pour', label: 'pour', caption: 'Build Your Matcha', animClass: 'is-pouring' },
  { kind: 'enjoy', label: 'enjoy', caption: 'Every Sip', animClass: 'is-enjoying' },
]

let effectIdSeq = 0

function RitualItem({ kind, label, caption, animClass }) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [effects, setEffects] = useState([])
  const btnRef = useRef(null)

  function handleClick() {
    setIsAnimating(false)
    void btnRef.current?.offsetWidth
    setIsAnimating(true)

    if (kind === 'pour') {
      setEffects((prev) => [...prev, { id: ++effectIdSeq, type: 'drop' }])
    }

    if (kind === 'enjoy') {
      const sparkles = Array.from({ length: 5 }, (_, i) => {
        const angle = (i / 5) * Math.PI * 2
        return {
          id: ++effectIdSeq,
          type: 'sparkle',
          symbol: i % 2 === 0 ? '✦' : '✧',
          sx: Math.round(Math.cos(angle) * 30),
          sy: Math.round(-18 + Math.sin(angle) * 12),
          delay: i * 25,
        }
      })
      setEffects((prev) => [...prev, ...sparkles])
    }
  }

  function removeEffect(id) {
    setEffects((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="ritual-item">
      <button
        type="button"
        ref={btnRef}
        className={'ritual-label' + (isAnimating ? ' ' + animClass : '')}
        onClick={handleClick}
        onAnimationEnd={() => setIsAnimating(false)}
      >
        {label}
      </button>
      <p>{caption}</p>
      {effects.map((e) =>
        e.type === 'drop' ? (
          <span key={e.id} className="ritual-drop" aria-hidden="true" onAnimationEnd={() => removeEffect(e.id)} />
        ) : (
          <span
            key={e.id}
            className="ritual-sparkle"
            aria-hidden="true"
            style={{ '--sx': e.sx + 'px', '--sy': e.sy + 'px', animationDelay: e.delay + 'ms' }}
            onAnimationEnd={() => removeEffect(e.id)}
          >
            {e.symbol}
          </span>
        ),
      )}
    </div>
  )
}

export default function RitualStrip() {
  return (
    <section className="ritual">
      <div className="ritual-inner">
        {RITUALS.map((r) => (
          <RitualItem key={r.kind} {...r} />
        ))}
      </div>
    </section>
  )
}
