import { useRef, useState } from 'react'
import { FEATURED_DRINK, MENU_DRINKS, formatPeso } from '../data/menu'
import { useReveal } from '../hooks/useReveal'

function FeaturedItem({ onOpen }) {
  const reveal = useReveal(0)

  function handleClick() {
    onOpen({ key: FEATURED_DRINK.key, name: FEATURED_DRINK.name, img: FEATURED_DRINK.img, price: FEATURED_DRINK.price })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      ref={reveal.ref}
      style={reveal.style}
      className={reveal.className + ' featured-item featured-glow'}
      tabIndex={0}
      role="button"
      aria-haspopup="dialog"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="featured-img-wrap">
        <img src={FEATURED_DRINK.img} alt={FEATURED_DRINK.imgAlt} className="featured-img" />
        <span className="menu-badge">{FEATURED_DRINK.badge}</span>
      </div>
      <div className="featured-text">
        <h3>{FEATURED_DRINK.name}</h3>
        <p>{FEATURED_DRINK.description}</p>
      </div>
      <span className="price price-lg">{formatPeso(FEATURED_DRINK.price)}</span>
    </div>
  )
}

function MenuTile({ drink, index, isSelected, onSelect, onOpen }) {
  const reveal = useReveal(index)
  const [pop, setPop] = useState(false)
  const tileElRef = useRef(null)

  function setRefs(node) {
    tileElRef.current = node
    reveal.ref.current = node
  }

  function handleClick() {
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
      className={reveal.className + ' menu-tile' + (isSelected ? ' is-selected' : '') + (pop ? ' pop' : '')}
      tabIndex={0}
      role="button"
      aria-haspopup="dialog"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onAnimationEnd={() => setPop(false)}
    >
      <img src={drink.img} alt={drink.imgAlt} loading="lazy" />
      <div className="menu-tile-overlay">
        <h3>{drink.name}</h3>
        <span className="price">{formatPeso(drink.price)}</span>
      </div>
    </div>
  )
}

export default function MenuSection({ onOpenSugarModal }) {
  const [selectedKey, setSelectedKey] = useState(null)

  function handleSelect(key) {
    setSelectedKey((prev) => (prev === key ? null : key))
  }

  return (
    <section id="menu" className="section">
      <div className="section-inner">
        <p className="eyebrow center">The Menu</p>
        <h2 className="section-title center">Build Your Matcha</h2>

        <FeaturedItem onOpen={onOpenSugarModal} />

        <div className="menu-grid">
          {MENU_DRINKS.map((drink, i) => (
            <MenuTile
              key={drink.key}
              drink={drink}
              index={i + 1}
              isSelected={selectedKey === drink.key}
              onSelect={handleSelect}
              onOpen={onOpenSugarModal}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
