import { useReveal } from '../hooks/useReveal'

export default function AboutSection() {
  const reveal = useReveal(0)

  return (
    <section id="about" className="section section-alt">
      <div ref={reveal.ref} style={reveal.style} className={reveal.className + ' section-inner about-inner'}>
        <p className="eyebrow center">Our Story</p>
        <h2 className="section-title center">About Mori Matcha</h2>
        {/* TODO: replace with your own story/vibe */}
        <p className="about-text">
          Mori Matcha started with a simple idea: matcha made properly, whisked fresh for every cup, never sitting
          around pre-made. Every drink on our menu is built to order — classic and clean, or dressed up with ube,
          strawberry, mango, or chocolate cookies.
        </p>
      </div>
    </section>
  )
}
