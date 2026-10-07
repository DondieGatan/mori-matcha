import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import BackToTop from '../components/BackToTop'
import PartyInquiry from '../components/PartyInquiry'
import { INSTAGRAM_DM_URL, INSTAGRAM_PROFILE_URL, formatPeso } from '../data/menu'
import { PARTY_ADDONS, PARTY_INCLUDED, PARTY_NOTES, PARTY_PACKAGES, PARTY_VARIETIES } from '../data/partyCart'
import { useReveal } from '../hooks/useReveal'

function Reveal({ index = 0, className = '', children }) {
  const reveal = useReveal(index)
  return (
    <div ref={reveal.ref} style={reveal.style} className={reveal.className + (className ? ' ' + className : '')}>
      {children}
    </div>
  )
}

export default function PartyCartPage() {
  const [pkgKey, setPkgKey] = useState(null)

  function choosePackage(key) {
    setPkgKey(key)
    document.getElementById('inquiry')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    document.title = 'Party Cart — Mori Matcha'
    const desc = document.querySelector('meta[name="description"]')
    if (desc) {
      desc.setAttribute(
        'content',
        'Mori Matcha Party Cart — a fresh matcha bar for birthdays, debuts, school events and celebrations. Packages from ₱3,000.',
      )
    }
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <Header onPartyPage />
      <main id="top">
        <section className="section party-hero">
          <div className="section-inner party-hero-inner">
            <Reveal>
              <p className="eyebrow center">Events &amp; Celebrations</p>
              <h1 className="party-title">Party Cart</h1>
              <p className="party-tagline">Whisk. Pour. Enjoy. &mdash; A fresh matcha bar for your celebration.</p>
            </Reveal>
            <Reveal index={1} className="party-card party-intro">
              <h2>Bring a little matcha magic to your event.</h2>
              <p>
                Our Mori Matcha Party Cart brings freshly prepared matcha drinks, served on-site for birthdays, debuts,
                school events, intimate celebrations, and more.
              </p>
            </Reveal>
            <Reveal index={2}>
              <a href="#inquiry" className="btn btn-primary party-hero-btn">
                Build Your Inquiry
              </a>
            </Reveal>
          </div>
        </section>

        <section id="packages" className="section section-alt">
          <div className="section-inner">
            <p className="eyebrow center">Choose a Package</p>
            <h2 className="section-title center">Party Cart Packages</h2>
            <div className="party-packages">
              {PARTY_PACKAGES.map((pkg, i) => (
                <Reveal key={pkg.key} index={i} className={'party-package' + (pkgKey === pkg.key ? ' is-selected' : '')}>
                  <h3>{pkg.name}</h3>
                  <p className="party-package-meta">
                    {pkg.guests} guests &middot; {pkg.service}
                  </p>
                  <p className="party-package-price">{formatPeso(pkg.price)}</p>
                  <p className="party-package-per">about {formatPeso(pkg.perGuest)} per guest</p>
                  <button type="button" className={'btn party-choose ' + (pkgKey === pkg.key ? 'btn-primary' : 'btn-ghost')} onClick={() => choosePackage(pkg.key)}>
                    {pkgKey === pkg.key ? 'Selected ✓' : 'Choose this package'}
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-inner party-two-col">
            <Reveal className="party-card">
              <p className="eyebrow">Everything You Need</p>
              <h3>What&apos;s Included</h3>
              <ul className="party-list">
                {PARTY_INCLUDED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal index={1} className="party-card">
              <p className="eyebrow">Your Menu, Your Way</p>
              <h3>Choose Your Matcha Varieties</h3>
              <p className="party-label">Available event varieties:</p>
              <ul className="party-chips">
                {PARTY_VARIETIES.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
              <p className="party-fine">Client may choose the preferred varieties included in the selected package.</p>
            </Reveal>
          </div>
        </section>

        <section className="section section-alt">
          <div className="section-inner party-two-col">
            <Reveal className="party-card party-card-plain">
              <p className="eyebrow">Make It Yours</p>
              <h3>Optional Add-Ons</h3>
              <table className="hours-table party-addons">
                <tbody>
                  {PARTY_ADDONS.map((row) => (
                    <tr key={row.label}>
                      <th>{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            <Reveal index={1} className="party-card party-card-plain">
              <p className="eyebrow">Good to Know</p>
              <h3>Booking Notes</h3>
              <ul className="party-list">
                {PARTY_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="section">
          <div className="section-inner party-quick">
            <p className="eyebrow center">At a Glance</p>
            <h2 className="section-title center">Package Quick View</h2>
            <Reveal className="party-table-wrap">
              <table className="party-table">
                <thead>
                  <tr>
                    <th>Package</th>
                    <th>Guests</th>
                    <th>Price</th>
                    <th>Approx. price/person</th>
                  </tr>
                </thead>
                <tbody>
                  {PARTY_PACKAGES.map((pkg) => (
                    <tr key={pkg.key}>
                      <td>{pkg.short}</td>
                      <td>{pkg.guests}</td>
                      <td>{formatPeso(pkg.price)}</td>
                      <td>{formatPeso(pkg.perGuest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
        </section>

        <section id="inquiry" className="section section-alt">
          <div className="section-inner">
            <p className="eyebrow center">Plan Your Event</p>
            <h2 className="section-title center">Build Your Inquiry</h2>
            <PartyInquiry pkgKey={pkgKey} onPkgChange={setPkgKey} />
          </div>
        </section>

        <section className="section contact-section">
          <Reveal className="section-inner contact-inner">
            <p className="eyebrow center">Book Your Date</p>
            <h2 className="section-title center party-cta-title">Ready to make your celebration a little greener?</h2>
            <p className="contact-sub party-cta-sub">
              Message Mori Matcha to check availability and customize your package. Each event can be tailored to your
              preferred matcha varieties and guest count.
            </p>
            <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-primary">
              Message on Instagram
            </a>
            <a href={INSTAGRAM_PROFILE_URL} target="_blank" rel="noopener" className="follow-card">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" />
              </svg>
              <span>
                <strong>@mori_matchaofficial</strong>
                <em>Whisk. Pour. Enjoy.</em>
              </span>
            </a>
          </Reveal>
        </section>
      </main>
      <Footer />
      <BackToTop />
    </>
  )
}
