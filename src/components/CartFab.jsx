import { formatPeso } from '../data/menu'
import { useBump } from '../hooks/useBump'

export default function CartFab({ cartCount, cartTotal, bumpKey, onOpenCart }) {
  const ref = useBump(bumpKey)

  return (
    <button type="button" className="cart-fab" ref={ref} hidden={cartCount === 0} aria-label="View cart" onClick={onOpenCart}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h7.1a2 2 0 0 0 2-1.6L20 8H6" />
        <circle cx="10" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
      </svg>
      <span>View Cart</span>
      <span className="cart-fab-badge">{cartCount}</span>
      <span className="cart-fab-total">{formatPeso(cartTotal)}</span>
    </button>
  )
}
