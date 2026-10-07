import { useMemo, useState } from 'react'
import { INSTAGRAM_DM_URL, formatPeso } from '../data/menu'
import { PARTY_ADDONS, PARTY_EVENT_TYPES, PARTY_PACKAGES, PARTY_VARIETIES } from '../data/partyCart'

const MILK_CHOICES = ['Full Cream', 'Oat Milk']
const MAX_GUESTS = 500
const EMPTY = {
  name: '',
  eventType: '',
  date: '',
  guests: '',
  location: '',
  varieties: [],
  milk: '',
  addons: [],
  notes: '',
}

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function prettyDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export default function PartyInquiry({ pkgKey, onPkgChange }) {
  const [form, setForm] = useState(EMPTY)
  const [showErrors, setShowErrors] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy Inquiry')

  const pkg = PARTY_PACKAGES.find((p) => p.key === pkgKey) || null
  // Whole numbers only: "1e3", "2.5" and "-5" are rejected instead of being silently misread.
  const guestsText = form.guests.trim()
  const guests = /^\d+$/.test(guestsText) ? parseInt(guestsText, 10) : NaN
  const guestsValid = Number.isInteger(guests) && guests >= 1 && guests <= MAX_GUESTS
  const today = todayISO()

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const errors = {}
  if (!pkg) errors.pkg = 'Choose a package.'
  if (!form.date) errors.date = 'Pick your event date.'
  else if (form.date < today) errors.date = 'Pick a date from today onward.'
  if (!guestsValid) errors.guests = guestsText ? 'Enter a whole number from 1 to ' + MAX_GUESTS + '.' : 'Enter how many guests.'
  if (!form.location.trim()) errors.location = 'Tell us where the event will be.'
  const isValid = Object.keys(errors).length === 0

  // Smallest package that covers the guest count.
  const suggested = guestsValid ? PARTY_PACKAGES.find((p) => p.guests >= guests) || null : null
  let hint = null
  if (guestsValid && guests > 100) {
    hint = { text: 'For more than 100 guests we will prepare a custom quote for you.' }
  } else if (guestsValid && pkg && guests > pkg.guests) {
    hint = {
      text:
        pkg.name + ' covers up to ' + pkg.guests + ' guests. You can move up to the ' + (suggested ? suggested.name : 'next package') +
        ', or add extra drinks (' + PARTY_ADDONS[0].value + ').',
      useKey: suggested && suggested.key,
    }
  } else if (guestsValid && !pkg && suggested) {
    hint = { text: 'For ' + guests + ' guests, we suggest the ' + suggested.name + ' (up to ' + suggested.guests + ' guests).', useKey: suggested.key }
  }

  const message = useMemo(() => {
    const lines = ["Hi Mori Matcha! I'd like to inquire about a Party Cart booking.", '']
    if (form.name.trim()) lines.push('Name: ' + form.name.trim())
    if (pkg) {
      lines.push('Package: ' + pkg.name + ' (' + pkg.guests + ' guests, ' + pkg.service + ') - ' + formatPeso(pkg.price))
    }
    if (form.eventType) lines.push('Event type: ' + form.eventType)
    if (form.date) lines.push('Event date: ' + prettyDate(form.date))
    if (guestsValid) lines.push('Guest count: ' + guests)
    if (form.location.trim()) lines.push('Location / venue: ' + form.location.trim())
    if (form.varieties.length) lines.push('Matcha varieties: ' + form.varieties.join(', '))
    if (form.milk) lines.push('Milk: ' + form.milk)
    if (form.addons.length) lines.push('Add-ons: ' + form.addons.join(', '))
    if (form.notes.trim()) lines.push('Notes: ' + form.notes.trim())
    lines.push('', 'Could you please confirm availability and the next steps? Thank you!')
    return lines.join('\n')
  }, [form, pkg, guests, guestsValid])

  function copyText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(() => window.prompt('Copy your inquiry:', text))
    } else {
      window.prompt('Copy your inquiry:', text)
    }
  }

  function showProblems() {
    setShowErrors(true)
    const order = [['pkg', 'pi-pkg'], ['date', 'pi-date'], ['guests', 'pi-guests'], ['location', 'pi-location']]
    const first = order.find(([key]) => errors[key])
    if (first) document.getElementById(first[1])?.focus()
  }

  function handleCopy() {
    if (!isValid) {
      showProblems()
      return
    }
    copyText(message, () => {
      setCopyLabel('Copied ✓')
      setTimeout(() => setCopyLabel('Copy Inquiry'), 1500)
    })
  }

  function handleSend(e) {
    if (!isValid) {
      e.preventDefault()
      showProblems()
      return
    }
    // Instagram can't be pre-filled, so copy the message for the customer to paste.
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(message).catch(() => {})
  }

  const err = (key) => (showErrors && errors[key] ? <span className="party-error">{errors[key]}</span> : null)

  return (
    <div className="party-inquiry">
      <ol className="party-steps" aria-label="How it works">
        <li>
          <strong>Fill in your details</strong>
          <span>Pick a package, then add your date, guests and location.</span>
        </li>
        <li>
          <strong>Press &quot;Copy Inquiry&quot;</strong>
          <span>Your message is copied, ready to paste.</span>
        </li>
        <li>
          <strong>Press &quot;Send via Instagram&quot;</strong>
          <span>Our chat opens. Paste your message and send it.</span>
        </li>
        <li>
          <strong>We confirm your date</strong>
          <span>We reply to confirm availability and the 50% deposit details.</span>
        </li>
      </ol>

      <div className="party-inquiry-grid">
        <form className="party-card party-form" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="party-field">
            <label htmlFor="pi-pkg">Package</label>
            <select id="pi-pkg" value={pkgKey || ''} onChange={(e) => onPkgChange(e.target.value || null)} aria-invalid={showErrors && !!errors.pkg}>
              <option value="">Select a package</option>
              {PARTY_PACKAGES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} &ndash; {p.guests} guests &ndash; {formatPeso(p.price)}
                </option>
              ))}
            </select>
            {err('pkg')}
          </div>

          <div className="party-row">
            <div className="party-field">
              <label htmlFor="pi-date">Event date</label>
              <input id="pi-date" type="date" min={today} max="2100-12-31" value={form.date} onChange={(e) => set('date', e.target.value)} aria-invalid={showErrors && !!errors.date} />
              {err('date')}
            </div>
            <div className="party-field">
              <label htmlFor="pi-guests">Number of guests</label>
              <input id="pi-guests" type="number" inputMode="numeric" min="1" max={MAX_GUESTS} step="1" placeholder="e.g. 30" value={form.guests} onChange={(e) => set('guests', e.target.value)} aria-invalid={showErrors && !!errors.guests} />
              {err('guests')}
            </div>
          </div>

          {hint && (
            <p className="party-hint">
              {hint.text}
              {hint.useKey && hint.useKey !== pkgKey && (
                <button type="button" className="party-hint-btn" onClick={() => onPkgChange(hint.useKey)}>
                  Use this package
                </button>
              )}
            </p>
          )}

          <div className="party-field">
            <label htmlFor="pi-location">Event location / venue</label>
            <input id="pi-location" type="text" placeholder="Venue name and city" value={form.location} onChange={(e) => set('location', e.target.value)} aria-invalid={showErrors && !!errors.location} />
            {err('location')}
          </div>

          <div className="party-row">
            <div className="party-field">
              <label htmlFor="pi-name">Your name <span className="party-opt">(optional)</span></label>
              <input id="pi-name" type="text" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="party-field">
              <label htmlFor="pi-type">Event type <span className="party-opt">(optional)</span></label>
              <select id="pi-type" value={form.eventType} onChange={(e) => set('eventType', e.target.value)}>
                <option value="">Select</option>
                {PARTY_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="party-field party-fieldset">
            <legend>Matcha varieties <span className="party-opt">(optional)</span></legend>
            <div className="party-options">
              {PARTY_VARIETIES.map((v) => (
                <label key={v} className={'party-option' + (form.varieties.includes(v) ? ' is-on' : '')}>
                  <input type="checkbox" checked={form.varieties.includes(v)} onChange={() => set('varieties', toggle(form.varieties, v))} />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="party-field party-fieldset">
            <legend>Milk <span className="party-opt">(optional)</span></legend>
            <div className="party-options">
              {MILK_CHOICES.map((m) => (
                <label key={m} className={'party-option' + (form.milk === m ? ' is-on' : '')}>
                  <input type="radio" name="pi-milk" checked={form.milk === m} onChange={() => set('milk', m)} />
                  {m}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="party-field party-fieldset">
            <legend>Add-ons <span className="party-opt">(optional)</span></legend>
            <div className="party-options">
              {PARTY_ADDONS.map((a) => (
                <label key={a.label} className={'party-option' + (form.addons.includes(a.label) ? ' is-on' : '')}>
                  <input type="checkbox" checked={form.addons.includes(a.label)} onChange={() => set('addons', toggle(form.addons, a.label))} />
                  {a.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="party-field">
            <label htmlFor="pi-notes">Anything else? <span className="party-opt">(optional)</span></label>
            <textarea id="pi-notes" rows="3" maxLength="400" placeholder="Theme, timing, special requests..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </form>

        <aside className="party-card party-preview">
          <p className="eyebrow">Your message</p>
          <h3>Ready to send</h3>
          {pkg && (
            <div className="party-estimate">
              <div>
                <span>{pkg.name}</span>
                <strong>{formatPeso(pkg.price)}</strong>
              </div>
              <div>
                <span>50% deposit to reserve the date</span>
                <strong>{formatPeso(pkg.price / 2)}</strong>
              </div>
            </div>
          )}
          <pre className="party-message">{message}</pre>
          {showErrors && !isValid && <p className="party-error party-error-block">Please fill in the package, date, guests and location first.</p>}
          <span className="sr-only" role="status">
            {copyLabel !== 'Copy Inquiry' ? 'Inquiry copied to the clipboard.' : ''}
          </span>
          <div className="party-actions">
            <button type="button" className="btn btn-ghost" onClick={handleCopy}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V6a2 2 0 0 1 2-2h9" />
              </svg>
              {copyLabel}
            </button>
            <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-primary" onClick={handleSend}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" />
              </svg>
              Send via Instagram
            </a>
          </div>
          <p className="party-fine">Your date is reserved once the 50% deposit is paid. We&apos;ll reply with payment details after confirming availability.</p>
        </aside>
      </div>
    </div>
  )
}
