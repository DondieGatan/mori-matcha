import { INSTAGRAM_DM_URL, REVIEWS } from '../data/menu'

export default function FeedbackSection() {
  return (
    <section id="feedback" className="section">
      <div className="section-inner feedback-inner">
        <p className="eyebrow center">What People Are Saying</p>
        <h2 className="section-title center">Customer Feedback</h2>

        <div className="feedback-grid">
          {REVIEWS.map((review, i) => {
            let stars = ''
            for (let s = 0; s < 5; s++) stars += s < review.rating ? '★' : '☆'
            return (
              <div className="feedback-card" key={i}>
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
          })}
        </div>
        {REVIEWS.length === 0 && (
          <p className="feedback-empty">No reviews yet — be the first to share your experience!</p>
        )}

        <div className="feedback-cta">
          <p>Loved your matcha? We'd love to hear about it.</p>
          <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-ghost">
            Leave Feedback via Instagram
          </a>
        </div>
      </div>
    </section>
  )
}
