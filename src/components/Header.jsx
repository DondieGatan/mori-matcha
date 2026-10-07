import { useBump } from '../hooks/useBump'

export default function Header({ cartCount, bumpKey, onOpenCart, onPartyPage = false }) {
  const cartBtnRef = useBump(bumpKey)
  // On the Party Cart page the section anchors live on the home page.
  const home = onPartyPage ? '/' : ''

  return (
    <header className="nav">
      <div className="nav-inner">
        <a href={onPartyPage ? '/' : '#top'} className="nav-brand">
          <img src="/assets/logo.png" alt="" onError={(e) => e.currentTarget.remove()} />
          MORI <span>MATCHA</span>
        </a>
        <nav className="nav-links">
          <a href={home + '#menu'}>Menu</a>
          <a href="/party-cart" aria-current={onPartyPage ? 'page' : undefined}>Party Cart</a>
          <a href={home + '#about'}>About</a>
          <a href={home + '#visit'}>Visit</a>
          {!onPartyPage && (
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
          )}
        </nav>
      </div>
    </header>
  )
}
