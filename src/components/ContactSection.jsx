import { FACEBOOK_URL, INSTAGRAM_DM_URL, INSTAGRAM_PROFILE_URL, TIKTOK_URL } from '../data/menu'

export default function ContactSection() {
  return (
    <section id="contact" className="section section-alt contact-section">
      <div className="section-inner contact-inner">
        <p className="eyebrow center">Get in Touch</p>
        <h2 className="section-title center">Order Your Matcha</h2>
        <p className="contact-sub">Message us on Instagram, Facebook, or TikTok to place an order.</p>
        <div className="contact-links">
          <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-primary">
            Order Now
          </a>
        </div>
        <div className="social-links">
          <a href={INSTAGRAM_PROFILE_URL} target="_blank" rel="noopener" className="social-link" aria-label="Instagram">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" />
            </svg>
          </a>
          <a href={FACEBOOK_URL + '#'} target="_blank" rel="noopener" className="social-link" aria-label="Facebook">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 3h-2a5 5 0 0 0-5 5v2H6v4h2v7h4v-7h3l1-4h-4V8a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>
          <a href={TIKTOK_URL} target="_blank" rel="noopener" className="social-link" aria-label="TikTok">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
              <path d="M14 3c0 2.5 2 4.5 4.5 4.5V10c-1.7 0-3.2-.6-4.5-1.5" />
            </svg>
          </a>
        </div>

        <a href={INSTAGRAM_PROFILE_URL} target="_blank" rel="noopener" className="follow-card">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" />
          </svg>
          <span>
            <strong>@mori_matchaofficial</strong>
            <em>Follow along for new drinks &amp; daily specials</em>
          </span>
        </a>
      </div>
    </section>
  )
}
