import { useBump } from '../hooks/useBump'

export default function Header({ cartCount, bumpKey, onOpenCart }) {
  const cartBtnRef = useBump(bumpKey)

  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="#top" className="nav-brand">
          <img src="/assets/logo.png" alt="" onError={(e) => e.currentTarget.remove()} />
          MORI <span>MATCHA</span>
        </a>
        <nav className="nav-links">
          <a href="#menu">Menu</a>
          <a href="#about">About</a>
          <a href="#visit">Visit</a>
          <button
            type="button"
            className="cart-btn"
            ref={cartBtnRef}
            aria-haspopup="dialog"
            aria-label="View cart"
            onClick={onOpenCart}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h7.1a2 2 0 0 0 2-1.6L20 8H6" />
              <circle cx="10" cy="20" r="1.4" />
              <circle cx="17" cy="20" r="1.4" />
            </svg>
            <span className="cart-count" hidden={cartCount === 0}>
              {cartCount}
            </span>
          </button>
          <a href="#contact" className="nav-cta">
            Order
          </a>
        </nav>
      </div>
    </header>
  )
}
