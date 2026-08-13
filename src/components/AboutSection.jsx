import { useReveal } from '../hooks/useReveal'

export default function AboutSection() {
  const reveal = useReveal(0)

  return (
    <section id="about" className="section section-alt">
      <div ref={reveal.ref} style={reveal.style} className={reveal.className + ' section-inner about-inner'}>
        <p className="eyebrow center">Our Story</p>
        <h2 className="section-title center">About Mori Matcha</h2>
        <p className="about-text">
          Mori Matcha began as a home café in Imus, Cavite, built on a simple idea: matcha made properly, whisked
          fresh for every cup, never sitting around pre-made. That same care carries through today — every drink on
          our menu is still built to order, from the classic and clean to creamy ube, bright strawberry, mango, and
          chocolate cookies.
        </p>
      </div>
    </section>
  )
}
