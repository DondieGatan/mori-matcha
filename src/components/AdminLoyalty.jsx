import { useCallback, useEffect, useState } from 'react'
import { STAMPS_PER_REWARD } from '../data/loyalty'

// Staff-only loyalty panel for the admin page. Every button here calls /api/loyalty with the admin key; the server does the
// checking (paid order, one stamp per order, enough stamps for a reward), so nothing here can be tampered with from a browser.

const STAFF_KEY = 'mori-admin-staff-name'

async function api(adminKey, body) {
  const res = await fetch('/api/loyalty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

function itemsText(items) {
  if (!Array.isArray(items)) return ''
  return items.map((i) => `${i.qty || 1}× ${i.name}`).join(', ')
}

export default function AdminLoyalty({ adminKey }) {
  const [staff, setStaff] = useState(() => {
    try {
      return localStorage.getItem(STAFF_KEY) || ''
    } catch {
      return ''
    }
  })
  const [q, setQ] = useState('')
  const [cards, setCards] = useState(null)
  const [eligible, setEligible] = useState([])
  const [newLabel, setNewLabel] = useState('')
  const [created, setCreated] = useState(null) // { cardNumber, label, link }
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null) // card number whose panel is open
  const [pick, setPick] = useState('') // order number chosen to stamp
  const [ledger, setLedger] = useState([])

  const refresh = useCallback(
    async (query = q) => {
      try {
        const [c, e] = await Promise.all([api(adminKey, { action: 'search', q: query }), api(adminKey, { action: 'eligible' })])
        setCards(c.cards)
        setEligible(e.orders)
      } catch (err) {
        setError(err.message)
      }
    },
    [adminKey, q],
  )

  useEffect(() => {
    refresh('')
  }, [adminKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function rememberStaff(v) {
    setStaff(v)
    try {
      localStorage.setItem(STAFF_KEY, v)
    } catch {
      // not saved, fine
    }
  }

  async function run(label, body, after) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api(adminKey, { ...body, staff })
      if (after) await after(data)
      setMessage(label(data))
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const linkFor = (token) => `${window.location.origin}/card#${token}`

  async function openCard(cardNumber) {
    if (open === cardNumber) {
      setOpen(null)
      return
    }
    setOpen(cardNumber)
    setPick('')
    try {
      const data = await api(adminKey, { action: 'ledger', cardNumber })
      setLedger(data.entries)
    } catch (err) {
      setError(err.message)
    }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text).then(
      () => setMessage('Copied.'),
      () => window.prompt('Copy this:', text),
    )
  }

  return (
    <div className="admin-loyalty">
      <p className="admin-loyalty-intro">
        One stamp per drink, only for orders marked <b>paid</b>. Each order can be stamped once. {STAMPS_PER_REWARD} stamps earn a free drink.
        Everything you do here is recorded.
      </p>

      <div className="admin-loyalty-row">
        <label>
          Your name (recorded with every change)
          <input value={staff} onChange={(e) => rememberStaff(e.target.value)} maxLength={40} placeholder="e.g. Ana" />
        </label>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {message && !error && <p className="admin-loyalty-ok">{message}</p>}

      <form
        className="admin-loyalty-row admin-loyalty-new"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            (d) => `Card ${d.card.cardNumber} created.`,
            { action: 'create', label: newLabel },
            (d) => {
              setCreated({ cardNumber: d.card.cardNumber, label: d.card.label, link: linkFor(d.token) })
              setNewLabel('')
            },
          )
        }}
      >
        <label>
          New card for (name or Instagram handle)
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={60} placeholder="@juandelacruz" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || !newLabel.trim()}>
          Create card
        </button>
      </form>

      {created && (
        <div className="admin-loyalty-created">
          <p>
            <b>{created.cardNumber}</b> for {created.label}. Send this private link to the customer on Instagram. It is shown only now; if
            it is lost, use &ldquo;New link&rdquo; on the card.
          </p>
          <input readOnly value={created.link} onFocus={(e) => e.target.select()} aria-label="Private card link" />
          <div className="admin-loyalty-btns">
            <button type="button" className="btn btn-ghost" onClick={() => copy(created.link)}>
              Copy link
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <form
        className="admin-loyalty-row"
        onSubmit={(e) => {
          e.preventDefault()
          refresh(q)
        }}
      >
        <label>
          Find a card
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Card number or name" />
        </label>
        <button type="submit" className="btn btn-ghost">
          Search
        </button>
      </form>

      {cards && cards.length === 0 && <p>No cards found.</p>}
      {cards && cards.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Name</th>
                <th>Stamps</th>
                <th>Free drinks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <FragmentRow key={c.cardNumber}>
                  <tr className={c.disabled ? 'is-disabled' : ''}>
                    <td>
                      <b>{c.cardNumber}</b>
                    </td>
                    <td>
                      {c.label}
                      {c.disabled && <em> (disabled)</em>}
                    </td>
                    <td>
                      {c.balance} / {STAMPS_PER_REWARD}
                    </td>
                    <td>
                      {c.rewardsReady > 0 ? <b className="admin-loyalty-ready">{c.rewardsReady} ready</b> : '—'} <small>({c.rewardsRedeemed} used)</small>
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost admin-small" onClick={() => openCard(c.cardNumber)}>
                        {open === c.cardNumber ? 'Close' : 'Open'}
                      </button>
                    </td>
                  </tr>
                  {open === c.cardNumber && (
                    <tr>
                      <td colSpan={5} className="admin-loyalty-detail">
                        <div className="admin-loyalty-stamp">
                          <label>
                            Add a stamp from a paid order
                            <select value={pick} onChange={(e) => setPick(e.target.value)}>
                              <option value="">Choose a paid order…</option>
                              {eligible.map((o) => (
                                <option key={o.orderNumber} value={o.orderNumber}>
                                  {o.orderNumber} · ₱{o.total} · {itemsText(o.items)} → {o.stamps} stamp{o.stamps === 1 ? '' : 's'}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy || !pick || c.disabled}
                            onClick={() =>
                              run((d) => `${d.stamped} stamp${d.stamped === 1 ? '' : 's'} added to ${c.cardNumber}.`, { action: 'stamp', cardNumber: c.cardNumber, orderNumber: pick }, async () => {
                                setPick('')
                                const l = await api(adminKey, { action: 'ledger', cardNumber: c.cardNumber })
                                setLedger(l.entries)
                              })
                            }
                          >
                            Add stamp
                          </button>
                        </div>
                        {eligible.length === 0 && <p className="admin-loyalty-hint">No paid orders are waiting for a stamp. Mark an order as paid on the Orders tab first.</p>}

                        <div className="admin-loyalty-btns">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy || c.rewardsReady < 1 || c.disabled}
                            onClick={() => {
                              if (!window.confirm(`Give ${c.label} a free drink? This uses ${STAMPS_PER_REWARD} stamps.`)) return
                              run(() => `Free drink given to ${c.cardNumber}.`, { action: 'redeem', cardNumber: c.cardNumber }, async () => {
                                const l = await api(adminKey, { action: 'ledger', cardNumber: c.cardNumber })
                                setLedger(l.entries)
                              })
                            }}
                          >
                            Give free drink
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm('Make a new private link? The old link will stop working.')) return
                              run(
                                (d) => `New link for ${d.card.cardNumber} ready below.`,
                                { action: 'regenerate', cardNumber: c.cardNumber },
                                (d) => setCreated({ cardNumber: d.card.cardNumber, label: d.card.label, link: linkFor(d.token) }),
                              )
                            }}
                          >
                            New link
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => run(() => (c.disabled ? 'Card enabled.' : 'Card disabled.'), { action: c.disabled ? 'enable' : 'disable', cardNumber: c.cardNumber })}
                          >
                            {c.disabled ? 'Enable card' : 'Disable card'}
                          </button>
                        </div>

                        <h4>History</h4>
                        <ul className="admin-loyalty-ledger">
                          {ledger.map((l) => (
                            <li key={l.id}>
                              <span>
                                <b>{l.kind === 'stamp' ? `+${l.stamps} stamp${l.stamps === 1 ? '' : 's'}` : l.kind === 'redeem' ? 'Free drink' : 'Undone'}</b>
                                {l.order_number ? ` · order ${l.order_number}` : ''}
                                {l.staff ? ` · by ${l.staff}` : ''}
                                {l.note ? ` · ${l.note}` : ''}
                              </span>
                              <time>{new Date(l.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</time>
                              {(l.kind === 'stamp' || l.kind === 'redeem') && (
                                <button
                                  type="button"
                                  className="admin-delete-btn"
                                  disabled={busy}
                                  onClick={() => {
                                    if (!window.confirm('Undo this entry? It stays in the history as undone.')) return
                                    run(() => 'Entry undone.', { action: 'void', entryId: l.id }, async () => {
                                      const x = await api(adminKey, { action: 'ledger', cardNumber: c.cardNumber })
                                      setLedger(x.entries)
                                    })
                                  }}
                                >
                                  Undo
                                </button>
                              )}
                            </li>
                          ))}
                          {ledger.length === 0 && <li>No activity yet.</li>}
                        </ul>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// A tbody-friendly fragment (two rows per card) without pulling in another import.
function FragmentRow({ children }) {
  return <>{children}</>
}
