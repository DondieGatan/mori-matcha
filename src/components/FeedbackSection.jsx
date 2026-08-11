import { INSTAGRAM_DM_URL, REVIEWS } from '../data/menu'
import { useReveal } from '../hooks/useReveal'

function FeedbackCard({ review, index }) {
  const reveal = useReveal(index)
  let stars = ''
  for (let s = 0; s < 5; s++) stars += s < review.rating ? '★' : '☆'

  return (
    <div ref={reveal.ref} style={reveal.style} className={reveal.className + ' feedback-card'}>
      <div className="feedback-stars" aria-label={review.rating + ' out of 5 stars'}>
        {stars}
      </div>
      <p className="feedback-text">“{review.text}”</p>
      <p className="feedback-meta">
        {review.name}
        {review.drink ? ' · ' + review.drink : ''}
      </p>
    </div>
  )
}

export default function FeedbackSection() {
  const emptyReveal = useReveal(0)
  const ctaReveal = useReveal(1)

  return (
    <section id="feedback" className="section">
      <div className="section-inner feedback-inner">
        <p className="eyebrow center">What People Are Saying</p>
        <h2 className="section-title center">Customer Feedback</h2>

        <div className="feedback-grid">
          {REVIEWS.map((review, i) => (
            <FeedbackCard review={review} index={i} key={i} />
          ))}
        </div>
        {REVIEWS.length === 0 && (
          <p ref={emptyReveal.ref} style={emptyReveal.style} className={emptyReveal.className + ' feedback-empty'}>
            No reviews yet — be the first to share your experience!
          </p>
        )}

        <div ref={ctaReveal.ref} style={ctaReveal.style} className={ctaReveal.className + ' feedback-cta'}>
          <p>Loved your matcha? We'd love to hear about it.</p>
          <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-ghost">
            Leave Feedback via Instagram
          </a>
        </div>
      </div>
    </section>
  )
}
