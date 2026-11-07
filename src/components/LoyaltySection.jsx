import { useReveal } from '../hooks/useReveal'
import { LoyaltyCardBack } from './LoyaltyCardArt'
import { INSTAGRAM_DM_URL } from '../data/menu'
import { CARD_SLOTS, STAMPS_PER_REWARD } from '../data/loyalty'

// Home page promo for the loyalty card. The card shown here is only an example; real cards live on the server.
export default function LoyaltySection() {
  const copy = useReveal(0)
  const art = useReveal(1)
  return (
    <section id="loyalty" className="section section-alt">
      <div className="section-inner loyalty-promo">
        <div ref={copy.ref} style={copy.style} className={copy.className + ' loyalty-promo-copy'}>
          <p className="eyebrow">Loyalty Card</p>
          <h2 className="section-title">Your {CARD_SLOTS}th drink is on us.</h2>
          <p>
            Every drink you order earns a stamp. Collect {STAMPS_PER_REWARD} and your {CARD_SLOTS}th drink is free. Your card lives on your phone,
            so there is nothing to lose or leave at home.
          </p>
          <ul className="loyalty-promo-list">
            <li>One stamp for every drink in a paid order</li>
            <li>Stamps are added by our team, so your card is always honest</li>
            <li>Show your card number when you order, and we do the rest</li>
          </ul>
          <div className="loyalty-promo-actions">
            <a href="/card" className="btn btn-primary">
              View my card
            </a>
            <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-ghost">
              Ask for a card
            </a>
          </div>
        </div>
        <div ref={art.ref} style={art.style} className={art.className + ' loyalty-promo-art'} aria-hidden="true">
          <LoyaltyCardBack balance={4} />
          <p className="loyalty-example">Example card</p>
        </div>
      </div>
    </section>
  )
}
