import { useEffect, useRef, useState } from 'react'
import { LEVEL_ORDER, MILK_ELIGIBLE_DRINKS, MILK_OPTIONS, MILK_SURCHARGE, SUGAR_DATA, formatPeso, milkSurcharge } from '../data/menu'

export default function SugarModal({ drink, onClose, onAddToCart }) {
  const [hidden, setHidden] = useState(true)
  const [openClass, setOpenClass] = useState(false)
  const [level, setLevel] = useState('Regular')
  const [milk, setMilk] = useState('Regular Milk')
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const displayDrinkRef = useRef(null)
  const closeBtnRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const panelRef = useRef(null)

  if (drink) displayDrinkRef.current = drink
  const displayDrink = displayDrinkRef.current

  useEffect(() => {
    if (drink) {
      lastFocusedRef.current = document.activeElement
      setLevel('Regular')
      setMilk('Regular Milk')
      setQty(1)
      setAdded(false)
      setHidden(false)
      const raf = requestAnimationFrame(() => setOpenClass(true))
      document.body.style.overflow = 'hidden'
      const focusTimer = setTimeout(() => closeBtnRef.current?.focus(), 0)
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(focusTimer)
      }
    }

    setOpenClass(false)
    document.body.style.overflow = ''
    const t = setTimeout(() => setHidden(true), 250)
    return () => clearTimeout(t)
  }, [drink])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && drink) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [drink, onClose])

  function handleClose() {
    onClose()
    if (lastFocusedRef.current) lastFocusedRef.current.focus()
  }

  if (!displayDrink) return null

  const sugarData = SUGAR_DATA[displayDrink.key]
  const isMilkEligible = MILK_ELIGIBLE_DRINKS.indexOf(displayDrink.key) !== -1
  const unitPrice = displayDrink.price + milkSurcharge(milk)

  function handleAddToCart() {
    onAddToCart(displayDrink.key, displayDrink.name, level, milk, unitPrice, qty)
    setAdded(true)
    setTimeout(() => {
      handleClose()
    }, 550)
  }

  return (
    <div
      ref={panelRef}
      className={'sugar-modal' + (openClass ? ' is-open' : '')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sugar-modal-title"
      hidden={hidden}
    >
      <div className="sugar-modal-backdrop" onClick={handleClose} />
      <div className="sugar-modal-panel">
        <button type="button" className="sugar-modal-close" ref={closeBtnRef} aria-label="Close" onClick={handleClose}>
          &times;
        </button>
        <img className="sugar-modal-img" src={displayDrink.img} alt={displayDrink.name} />
        <div className="sugar-modal-body">
          <h3 id="sugar-modal-title">{displayDrink.name}</h3>
          <p className="sugar-modal-hint">Choose your sugar level</p>
          <div className="sugar-levels" role="group" aria-label="Sugar level">
            {LEVEL_ORDER.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={'sugar-level-btn' + (level === lvl ? ' is-active' : '')}
                onClick={() => setLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
          <p className="sugar-amount-hint">
            {sugarData.levels[level]} ml {sugarData.unit}
          </p>

          {isMilkEligible && (
            <div className="milk-options">
              <p className="sugar-modal-hint">Milk Options</p>
              <div className="milk-choices" role="group" aria-label="Milk option">
                {MILK_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={'sugar-level-btn' + (milk === m ? ' is-active' : '')}
                    onClick={() => setMilk(m)}
                  >
                    {m === 'Regular Milk' ? m : m + ' +' + formatPeso(MILK_SURCHARGE)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="qty-row">
            <span className="qty-label">Quantity</span>
            <div className="qty-stepper">
              <button
                type="button"
                className="qty-btn"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(q - 1, 1))}
              >
                &minus;
              </button>
              <span className="qty-value">{qty}</span>
              <button
                type="button"
                className="qty-btn"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(q + 1, 20))}
              >
                +
              </button>
            </div>
          </div>

          <button type="button" className="btn btn-primary add-to-cart-btn" disabled={added} onClick={handleAddToCart}>
            {added ? 'Added ✓' : 'Add to Cart — ' + formatPeso(unitPrice * qty)}
          </button>
        </div>
      </div>
    </div>
  )
}
