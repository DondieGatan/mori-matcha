import { useState } from 'react'
import { useReveal } from '../hooks/useReveal'

const FAQ_ITEMS = [
  {
    question: 'How do I order?',
    answer: (
      <>
        Tap any drink on <a href="#menu">the menu</a>, pick your sugar level and quantity, and add it to your cart.
        When you're ready, open your cart and send the order to us on Instagram.
      </>
    ),
  },
  {
    question: 'Can I choose how sweet my drink is?',
    answer:
      'Yes — every drink lets you pick 25%, 50%, Regular, or Sweet before adding it to your cart, so two orders of the same drink can each be made exactly how each person likes it.',
  },
  {
    question: 'How do I pay?',
    answer: "Send your order through Instagram and we'll confirm it and reply with GCash or bank transfer details.",
  },
  {
    question: 'Where are you located, and what are your hours?',
    answer: (
      <>
        We're at Golden City Subdivision, Anabu 2-F, Imus, Cavite. Hours vary by day — see the full schedule in <a href="#visit">Visit Us</a>.
      </>
    ),
  },
  {
    question: 'Do you offer delivery?',
    answer: "Message us on Instagram with your order and location and we'll let you know the best way to get it to you.",
  },
]

function FaqItem({ item, index }) {
  const [expanded, setExpanded] = useState(false)
  const reveal = useReveal(index)

  return (
    <div ref={reveal.ref} style={reveal.style} className={reveal.className + ' faq-item'}>
      <button type="button" className="faq-question" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
        <span>{item.question}</span>
        <svg className="faq-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="faq-answer" hidden={!expanded}>
        <p>{item.answer}</p>
      </div>
    </div>
  )
}

export default function FaqSection() {
  return (
    <section id="faq" className="section">
      <div className="section-inner faq-inner">
        <p className="eyebrow center">Good to Know</p>
        <h2 className="section-title center">Frequently Asked Questions</h2>
        <div className="faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={item.question} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
