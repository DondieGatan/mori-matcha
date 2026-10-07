import { useMemo, useState } from 'react'
import { INSTAGRAM_DM_URL, formatPeso } from '../data/menu'
import { PARTY_ADDONS, PARTY_EVENT_TYPES, PARTY_PACKAGES, PARTY_VARIETIES } from '../data/partyCart'

const MILK_CHOICES = ['Full Cream', 'Oat Milk', 'Not sure yet']
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
  const guests = parseInt(form.guests, 10)
  const guestsValid = Number.isFinite(guests) && guests > 0

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const errors = {}
  if (!pkg) errors.pkg = 'Choose a package.'
  if (!form.date) errors.date = 'Pick your event date.'
  if (!guestsValid) errors.guests = 'Enter how many guests.'
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

  function handleCopy() {
    if (!isValid) {
      setShowErrors(true)
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
      setShowErrors(true)
      return
    }
    // Instagram can't be pre-filled, so copy the message for the customer to paste.
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(message).catch(() => {})
  }

  const err = (key) => (showErrors && errors[key] ? <span className="party-error">{errors[key]}</span> : null)

  return (
    <div className="party-inquiry">
      <ol className="party-steps" aria-label="How it works">
        <li>Fill in your event details.</li>
        <li>Tap &quot;Copy Inquiry&quot; (or &quot;Send via Instagram&quot;).</li>
        <li>Paste it into our Instagram chat and send.</li>
        <li>We reply to confirm availability and the next steps.</li>
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
              <input id="pi-date" type="date" min={todayISO()} value={form.date} onChange={(e) => set('date', e.target.value)} aria-invalid={showErrors && !!errors.date} />
              {err('date')}
            </div>
            <div className="party-field">
              <label htmlFor="pi-guests">Number of guests</label>
              <input id="pi-guests" type="number" inputMode="numeric" min="1" max="500" placeholder="e.g. 30" value={form.guests} onChange={(e) => set('guests', e.target.value)} aria-invalid={showErrors && !!errors.guests} />
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

        <aside className="party-card party-preview" aria-live="polite">
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
          <div className="party-actions">
            <button type="button" className="btn btn-ghost" onClick={handleCopy}>
              {copyLabel}
            </button>
            <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener" className="btn btn-primary" onClick={handleSend}>
              Send via Instagram
            </a>
          </div>
          <p className="party-fine">Your date is reserved once the 50% deposit is paid. We&apos;ll reply with payment details after confirming availability.</p>
        </aside>
      </div>
    </div>
  )
}
