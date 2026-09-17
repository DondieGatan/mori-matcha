import { useRef, useState } from 'react'
import { FEATURED_DRINKS, MENU_DRINKS, formatPeso } from '../data/menu'
import { useReveal } from '../hooks/useReveal'

function FeaturedItem({ drink, index, onOpen, isUnavailable, isComingSoon }) {
  const reveal = useReveal(index)
  const isBlocked = isUnavailable || isComingSoon

  function handleClick() {
    if (isBlocked) return
    onOpen({ key: drink.key, name: drink.name, img: drink.img, price: drink.price })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const badgeClass = isUnavailable ? ' menu-badge-unavailable' : isComingSoon ? ' menu-badge-coming-soon' : ''
  const badgeText = isUnavailable ? 'Unavailable' : isComingSoon ? 'Coming Soon' : drink.badge

  return (
    <div
      ref={reveal.ref}
      style={reveal.style}
      className={
        reveal.className +
        ' featured-item featured-glow' +
        (isUnavailable ? ' is-unavailable' : '') +
        (isComingSoon ? ' is-coming-soon' : '')
      }
      tabIndex={0}
      role="button"
      aria-haspopup="dialog"
      aria-disabled={isBlocked}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="featured-img-wrap">
        <img src={drink.img} alt={drink.imgAlt} className="featured-img" />
        {badgeText && <span className={'menu-badge' + badgeClass}>{badgeText}</span>}
      </div>
      <div className="featured-text">
        <h3>{drink.name}</h3>
        <p>{drink.description}</p>
      </div>
      <span className="price price-lg">{formatPeso(drink.price)}</span>
    </div>
  )
}

function MenuTile({ drink, index, isSelected, isUnavailable, isComingSoon, onSelect, onOpen }) {
  const reveal = useReveal(index)
  const [pop, setPop] = useState(false)
  const tileElRef = useRef(null)
  const isBlocked = isUnavailable || isComingSoon

  function setRefs(node) {
    tileElRef.current = node
    reveal.ref.current = node
  }

  function handleClick() {
    if (isBlocked) return
    onOpen({ key: drink.key, name: drink.name, img: drink.img, price: drink.price })
    onSelect(drink.key)
    setPop(false)
    void tileElRef.current?.offsetWidth
    setPop(true)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      ref={setRefs}
      style={reveal.style}
      className={
        reveal.className +
        ' menu-tile' +
        (isSelected ? ' is-selected' : '') +
        (pop ? ' pop' : '') +
        (isUnavailable ? ' is-unavailable' : '') +
        (isComingSoon ? ' is-coming-soon' : '')
      }
      tabIndex={0}
      role="button"
      aria-haspopup="dialog"
      aria-disabled={isBlocked}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onAnimationEnd={() => setPop(false)}
    >
      <img src={drink.img} alt={drink.imgAlt} loading="lazy" />
      <div className="menu-tile-overlay">
        <h3>{drink.name}</h3>
        {isUnavailable ? (
          <span className="price">Unavailable</span>
        ) : isComingSoon ? (
          <span className="price">Coming Soon</span>
        ) : (
          <span className="price">{formatPeso(drink.price)}</span>
        )}
      </div>
    </div>
  )
}

// Status rank used to sort the grid so it always reads well regardless of
// which drinks happen to be marked available/coming-soon/unavailable at any
// given moment — purchasable drinks surface first, coming-soon next (still
// worth knowing about), unavailable last (least useful to see up top).
const STATUS_RANK = { available: 0, coming_soon: 1, unavailable: 2 }

function statusOf(key, unavailableKeys, comingSoonKeys) {
  if (unavailableKeys.includes(key)) return 'unavailable'
  if (comingSoonKeys.includes(key)) return 'coming_soon'
  return 'available'
}

export default function MenuSection({ onOpenSugarModal, unavailableKeys = [], comingSoonKeys = [] }) {
  const [selectedKey, setSelectedKey] = useState(null)

  function handleSelect(key) {
    setSelectedKey((prev) => (prev === key ? null : key))
  }

  const sortedDrinks = [...MENU_DRINKS].sort((a, b) => {
    const rankA = STATUS_RANK[statusOf(a.key, unavailableKeys, comingSoonKeys)]
    const rankB = STATUS_RANK[statusOf(b.key, unavailableKeys, comingSoonKeys)]
    return rankA - rankB
  })

  return (
    <section id="menu" className="section">
      <div className="section-inner">
        <p className="eyebrow center">The Menu</p>
        <h2 className="section-title center">Build Your Matcha</h2>

        <div className="featured-grid">
          {FEATURED_DRINKS.map((drink, i) => (
            <FeaturedItem
              key={drink.key}
              drink={drink}
              index={i}
              onOpen={onOpenSugarModal}
              isUnavailable={unavailableKeys.includes(drink.key)}
              isComingSoon={comingSoonKeys.includes(drink.key)}
            />
          ))}
        </div>

        <div className="menu-grid">
          {sortedDrinks.map((drink, i) => (
            <MenuTile
              key={drink.key}
              drink={drink}
              index={i + FEATURED_DRINKS.length}
              isSelected={selectedKey === drink.key}
              isUnavailable={unavailableKeys.includes(drink.key)}
              isComingSoon={comingSoonKeys.includes(drink.key)}
              onSelect={handleSelect}
              onOpen={onOpenSugarModal}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
