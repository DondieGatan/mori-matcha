import { useEffect, useRef, useState } from 'react'
import { INSTAGRAM_DM_URL, formatPeso } from '../data/menu'
import { submitOrder } from '../data/orderLog'

function buildOrderLines(cart) {
  return cart.map((item) => {
    let detail = item.level + ' sugar'
    if (item.milk && item.milk !== 'Regular Milk') detail += ', ' + item.milk
    return item.qty + 'x ' + item.name + ' (' + detail + ') — ' + formatPeso(item.unitPrice * item.qty)
  })
}

function buildOrderItems(cart) {
  return cart.map((item) => ({
    name: item.name,
    level: item.level,
    milk: item.milk,
    qty: item.qty,
    unitPrice: item.unitPrice,
  }))
}

export default function CartModal({ isOpen, cart, orderNumber, cartTotal, onClose, onChangeQty, onRemove, onClearAll }) {
  const [hidden, setHidden] = useState(true)
  const [openClass, setOpenClass] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy Order for Instagram')
  const [sentSnapshot, setSentSnapshot] = useState(null) // { orderNumber, totalText }

  const closeBtnRef = useRef(null)
  const lastFocusedRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      lastFocusedRef.current = document.activeElement
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
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function handleClose() {
    onClose()
    if (lastFocusedRef.current) lastFocusedRef.current.focus()
  }

  function handleCopy() {
    if (cart.length === 0) return
    const lines = buildOrderLines(cart)
    lines.push('Total: ' + formatPeso(cartTotal))
    const text = "Hi Mori Matcha! I'd like to order (Order #" + orderNumber + '):\n\n' + lines.join('\n')

    function showCopied() {
      setCopyLabel('Copied ✓')
      setTimeout(() => setCopyLabel('Copy Order for Instagram'), 1500)
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied).catch(() => window.prompt('Copy your order:', text))
    } else {
      window.prompt('Copy your order:', text)
    }
  }

  function handleSend() {
    if (cart.length === 0) return

    const sentOrderNumber = orderNumber
    const totalText = formatPeso(cartTotal)
    submitOrder(sentOrderNumber, buildOrderItems(cart), cartTotal)

    setSentSnapshot({ orderNumber: sentOrderNumber, totalText })
    onClearAll()

    setTimeout(() => {
      setSentSnapshot(null)
      handleClose()
    }, 1800)
  }

  const showFooter = cart.length > 0 || sentSnapshot
  const displayOrderNumber = sentSnapshot ? sentSnapshot.orderNumber : orderNumber
  const displayTotal = sentSnapshot ? sentSnapshot.totalText : formatPeso(cartTotal)

  return (
    <div className={'cart-modal' + (openClass ? ' is-open' : '')} role="dialog" aria-modal="true" aria-labelledby="cart-modal-title" hidden={hidden}>
      <div className="sugar-modal-backdrop" onClick={handleClose} />
      <div className="cart-panel">
        <div className="cart-header">
          <h3 id="cart-modal-title">Your Order</h3>
          <button type="button" className="sugar-modal-close" ref={closeBtnRef} aria-label="Close cart" onClick={handleClose}>
            &times;
          </button>
        </div>
        <div className="cart-items">
          {cart.map((item) => {
            let metaText = item.level + ' sugar'
            if (item.milk && item.milk !== 'Regular Milk') metaText += ' · ' + item.milk
            return (
              <div className="cart-item" key={item.id}>
                <div className="cart-item-info">
                  <strong>{item.name}</strong>
                  <span className="cart-item-meta">{metaText}</span>
                </div>
                <div className="cart-item-qty">
                  <button type="button" className="qty-btn" aria-label="Decrease quantity" onClick={() => onChangeQty(item.id, -1)}>
                    &minus;
                  </button>
                  <span className="qty-value">{item.qty}</span>
                  <button type="button" className="qty-btn" aria-label="Increase quantity" onClick={() => onChangeQty(item.id, 1)}>
                    +
                  </button>
                </div>
                <span className="cart-item-price">{formatPeso(item.unitPrice * item.qty)}</span>
                <button type="button" className="cart-item-remove" aria-label="Remove item" onClick={() => onRemove(item.id)}>
                  &times;
                </button>
              </div>
            )
          })}
        </div>
        {cart.length === 0 && !sentSnapshot && (
          <p className="cart-empty">Your cart is empty — tap a drink on the menu to add one.</p>
        )}
        {showFooter && (
          <div className="cart-footer">
            <p className="cart-order-number">Order #{displayOrderNumber}</p>
            <div className="cart-total-row">
              <span>Total</span>
              <span>{displayTotal}</span>
            </div>
            <button type="button" className="btn btn-ghost" onClick={handleCopy}>
              {copyLabel}
            </button>
            <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-primary" onClick={handleSend}>
              {sentSnapshot ? 'Order ' + sentSnapshot.orderNumber + ' Sent ✓' : 'Send Order via Instagram'}
            </a>
            <p className="cart-payment-note">We'll reply with GCash / bank transfer details once we confirm your order.</p>
          </div>
        )}
      </div>
    </div>
  )
}
