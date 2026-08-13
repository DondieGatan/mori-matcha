export default function Hero() {
  return (
    <section id="top" className="hero">
      <div className="hero-glass">
        <picture>
          <source srcSet="/assets/hero-cutout.webp" type="image/webp" />
          <img src="/assets/hero-cutout.png" alt="Iced matcha latte being poured, with milk and matcha swirled over ice" />
        </picture>
      </div>

      <div className="hero-content">
        <p className="eyebrow">Freshly Whisked · Made to Order</p>
        <h1>
          MORI
          <br />
          <span>Matcha</span>
        </h1>
        <p className="hero-sub">
          Ceremonial-grade matcha, whisked to order and built the way you like it — classic, creamy, or fruit-forward.
        </p>
        <a href="#menu" className="btn btn-primary">
          View the Menu
        </a>
      </div>
    </section>
  )
}
