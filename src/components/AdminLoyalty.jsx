import { useCallback, useEffect, useState } from 'react'
import { CARD_NUMBER_PATTERN, STAMPS_PER_REWARD } from '../data/loyalty'
import { LoyaltyCardBack } from './LoyaltyCardArt'

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

// How each kind of recorded change reads in a card's history.
function editText(h) {
  if (h.field === 'name') return ['Name changed', `${h.old_value} → ${h.new_value}`]
  if (h.field === 'number') return ['Card number changed', `${h.old_value} → ${h.new_value}`]
  if (h.field === 'status') return [h.new_value === 'disabled' ? 'Card disabled' : 'Card enabled', '']
  if (h.field === 'link') return ['New link made', 'the old link stopped working']
  return ['Changed', '']
}

const LINK_PROBLEM = {
  'not-saved':
    "This card was made before links could be saved, so its link can't be shown. Press New link once to make one that always shows here. The old link stops working.",
  unreadable: "The saved link can't be read (the admin key may have been changed). Press New link to make a fresh one.",
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
  const [edits, setEdits] = useState([])
  const [link, setLink] = useState(null) // { cardNumber, token, reason } for the open card
  const [editing, setEditing] = useState(null) // { card, label, number } while the edit form is open
  const [fresh, setFresh] = useState(null) // { card, from }: the stamp card shows stamps after `from` coming down

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

  // The history (stamps, free drinks, undos, edits) and the customer's private link for one card.
  async function loadDetail(cardNumber, { withLink = true } = {}) {
    const [l, k] = await Promise.all([api(adminKey, { action: 'ledger', cardNumber }), withLink ? api(adminKey, { action: 'link', cardNumber }) : null])
    setLedger(l.entries)
    setEdits(l.edits || [])
    if (k) setLink({ cardNumber, token: k.token, reason: k.reason })
  }

  // The Edit button in a card's row: opens the card if it is closed, and opens or closes the edit form.
  async function startEdit(c) {
    const form = { card: c.cardNumber, label: c.label, number: c.cardNumber }
    if (open === c.cardNumber) {
      setEditing(editing && editing.card === c.cardNumber ? null : form)
      return
    }
    setFresh(null)
    setOpen(c.cardNumber)
    setPick('')
    setLink(null)
    setEditing(form)
    try {
      await loadDetail(c.cardNumber)
    } catch (err) {
      setError(err.message)
    }
  }

  async function openCard(cardNumber) {
    setFresh(null)
    setEditing(null)
    if (open === cardNumber) {
      setOpen(null)
      return
    }
    setOpen(cardNumber)
    setPick('')
    setLink(null)
    try {
      await loadDetail(cardNumber)
    } catch (err) {
      setError(err.message)
    }
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          setError('')
          setMessage('Copied.')
        },
        () => window.prompt('Copy this:', text),
      )
    } else {
      window.prompt('Copy this:', text)
    }
  }

  function makeNewLink(c) {
    if (!window.confirm('Make a new private link? The old link will stop working.')) return
    run(
      (d) => `New link for ${d.card.cardNumber} is ready.`,
      { action: 'regenerate', cardNumber: c.cardNumber },
      async (d) => {
        setCreated({ cardNumber: d.card.cardNumber, label: d.card.label, link: linkFor(d.token) })
        await loadDetail(c.cardNumber)
      },
    )
  }

  function saveEdit(c) {
    const next = editing.number.trim().toUpperCase()
    const body = { action: 'edit', cardNumber: c.cardNumber }
    if (editing.label.trim() !== c.label) body.label = editing.label
    if (next !== c.cardNumber) body.newCardNumber = next
    run(
      (d) => (!d.changed ? 'Nothing was changed.' : d.card.cardNumber !== c.cardNumber ? `Saved. The card number is now ${d.card.cardNumber}, so tell the customer.` : 'Saved.'),
      body,
      async (d) => {
        setEditing(null)
        if (d.card.cardNumber !== c.cardNumber) setOpen(d.card.cardNumber)
        await loadDetail(d.card.cardNumber)
      },
    )
  }

  // Stamps, free drinks, undos and edits in one list, newest first.
  const history = [
    ...ledger.map((l) => ({ ...l, type: 'ledger', key: 'l' + l.id })),
    ...edits.map((e) => ({ ...e, type: 'edit', key: 'e' + e.id })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || (a.type === 'edit' ? -1 : 1))

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
            <b>{created.cardNumber}</b> for {created.label}. Send this private link to the customer on Instagram. You can see and copy it
            again any time by opening the card.
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
                  <tr className={'admin-loyalty-cardrow' + (c.disabled ? ' is-disabled' : '')}>
                    <td data-label="Card">
                      <b>{c.cardNumber}</b>
                    </td>
                    <td data-label="Name">
                      {c.label}
                      {c.disabled && <em> (disabled)</em>}
                    </td>
                    <td data-label="Stamps">
                      {c.balance} / {STAMPS_PER_REWARD}
                    </td>
                    <td data-label="Free drinks">
                      {c.rewardsReady > 0 ? <b className="admin-loyalty-ready">{c.rewardsReady} ready</b> : '—'} <small>({c.rewardsRedeemed} used)</small>
                    </td>
                    <td className="admin-loyalty-rowbtns">
                      <button type="button" className="btn btn-ghost admin-small" onClick={() => openCard(c.cardNumber)}>
                        {open === c.cardNumber ? 'Close' : 'Open'}
                      </button>
                      <button type="button" className="btn btn-ghost admin-small" disabled={busy} onClick={() => startEdit(c)} aria-label={`Edit ${c.cardNumber}`}>
                        Edit
                      </button>
                    </td>
                  </tr>
                  {open === c.cardNumber && (
                    <tr className="admin-loyalty-detailrow">
                      <td colSpan={5} className="admin-loyalty-detail">
                        <div className="admin-loyalty-detail-grid">
                          <div className="admin-loyalty-detail-card">
                            <LoyaltyCardBack balance={c.balance} freshFrom={fresh && fresh.card === c.cardNumber ? fresh.from : null} />
                            <div className="admin-loyalty-link">
                              <p className="admin-loyalty-link-title">Customer&apos;s private link</p>
                              {!link || link.cardNumber !== c.cardNumber ? (
                                <p className="admin-loyalty-hint">Loading…</p>
                              ) : link.token ? (
                                <>
                                  <div className="admin-loyalty-link-row">
                                    <input
                                      readOnly
                                      value={linkFor(link.token)}
                                      onFocus={(e) => e.target.select()}
                                      aria-label="This card's private link"
                                    />
                                    <button type="button" className="btn btn-primary admin-small" onClick={() => copy(linkFor(link.token))}>
                                      Copy link
                                    </button>
                                  </div>
                                  <p className="admin-loyalty-hint">
                                    Send this to the customer on Instagram. Anyone who has it can see this card, so only send it to them.
                                    {c.disabled ? ' This card is disabled, so the link will not work until you enable it.' : ''}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="admin-loyalty-hint">{LINK_PROBLEM[link.reason] || LINK_PROBLEM.unreadable}</p>
                                  <div className="admin-loyalty-btns">
                                    <button type="button" className="btn btn-primary admin-small" disabled={busy} onClick={() => makeNewLink(c)}>
                                      Make a link
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="admin-loyalty-detail-main">
                            {c.disabled && (
                              <div className="admin-loyalty-disabled" role="status">
                                <span>
                                  <b>This card is disabled.</b> The customer&apos;s link and the card number do not work until you enable it. Stamps and history are
                                  kept.
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-primary admin-small"
                                  disabled={busy}
                                  onClick={() => run(() => 'Card enabled.', { action: 'enable', cardNumber: c.cardNumber }, () => loadDetail(c.cardNumber, { withLink: false }))}
                                >
                                  Enable card
                                </button>
                              </div>
                            )}
                            {editing && editing.card === c.cardNumber && (
                              <form
                                className="admin-loyalty-edit"
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  saveEdit(c)
                                }}
                              >
                                <label>
                                  Name or Instagram handle
                                  <input
                                    value={editing.label}
                                    maxLength={60}
                                    onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                                    aria-label="Customer name"
                                  />
                                </label>
                                <label>
                                  Card number
                                  <input
                                    value={editing.number}
                                    maxLength={7}
                                    autoCapitalize="characters"
                                    spellCheck="false"
                                    onChange={(e) => setEditing({ ...editing, number: e.target.value.toUpperCase() })}
                                    aria-label="Card number"
                                  />
                                </label>
                                {!CARD_NUMBER_PATTERN.test(editing.number.trim()) && (
                                  <p className="admin-error">A card number looks like LC-7K3Q: LC- and 4 letters or numbers (no O, I, L, 0 or 1).</p>
                                )}
                                {editing.number.trim() !== c.cardNumber && CARD_NUMBER_PATTERN.test(editing.number.trim()) && (
                                  <p className="admin-loyalty-hint">
                                    The old number {c.cardNumber} stops working at once. The customer&apos;s link, stamps and history stay the same, but tell
                                    them their new number.
                                  </p>
                                )}
                                <div className="admin-loyalty-btns">
                                  <button
                                    type="submit"
                                    className="btn btn-primary admin-small"
                                    disabled={
                                      busy ||
                                      !editing.label.trim() ||
                                      !CARD_NUMBER_PATTERN.test(editing.number.trim()) ||
                                      (editing.label.trim() === c.label && editing.number.trim() === c.cardNumber)
                                    }
                                  >
                                    Save changes
                                  </button>
                                  <button type="button" className="btn btn-ghost admin-small" onClick={() => setEditing(null)}>
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            )}

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
                                onClick={() => {
                                  setFresh({ card: c.cardNumber, from: c.balance })
                                  run(
                                    (d) => `${d.stamped} stamp${d.stamped === 1 ? '' : 's'} added to ${c.cardNumber}.`,
                                    { action: 'stamp', cardNumber: c.cardNumber, orderNumber: pick },
                                    async () => {
                                      setPick('')
                                      await loadDetail(c.cardNumber, { withLink: false })
                                    },
                                  )
                                }}
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
                                  run(() => `Free drink given to ${c.cardNumber}.`, { action: 'redeem', cardNumber: c.cardNumber }, () => loadDetail(c.cardNumber, { withLink: false }))
                                }}
                              >
                                Give free drink
                              </button>
                              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => makeNewLink(c)}>
                                New link
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={() => {
                                  if (!c.disabled && !window.confirm(`Disable ${c.cardNumber} (${c.label})? Its link and number stop working until you enable it again.`)) return
                                  run(() => (c.disabled ? 'Card enabled.' : 'Card disabled.'), { action: c.disabled ? 'enable' : 'disable', cardNumber: c.cardNumber }, () => loadDetail(c.cardNumber, { withLink: false }))
                                }}
                              >
                                {c.disabled ? 'Enable card' : 'Disable card'}
                              </button>
                            </div>

                            <h4>History</h4>
                            <ul className="admin-loyalty-ledger">
                              {history.map((h) =>
                                h.type === 'edit' ? (
                                  <li key={h.key}>
                                    <span>
                                      <b>{editText(h)[0]}</b>
                                      {editText(h)[1] ? ` · ${editText(h)[1]}` : ''}
                                      {h.staff ? ` · by ${h.staff}` : ' · no name recorded'}
                                    </span>
                                    <time>{new Date(h.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</time>
                                  </li>
                                ) : (
                                  <li key={h.key}>
                                    <span>
                                      <b>{h.kind === 'stamp' ? `+${h.stamps} stamp${h.stamps === 1 ? '' : 's'}` : h.kind === 'redeem' ? 'Free drink' : 'Undone'}</b>
                                      {h.order_number ? ` · order ${h.order_number}` : ''}
                                      {h.staff ? ` · by ${h.staff}` : ''}
                                      {h.note ? ` · ${h.note}` : ''}
                                    </span>
                                    <time>{new Date(h.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</time>
                                    {(h.kind === 'stamp' || h.kind === 'redeem') && (
                                      <button
                                        type="button"
                                        className="admin-delete-btn"
                                        disabled={busy}
                                        onClick={() => {
                                          if (!window.confirm('Undo this entry? It stays in the history as undone.')) return
                                          run(() => 'Entry undone.', { action: 'void', entryId: h.id }, () => loadDetail(c.cardNumber, { withLink: false }))
                                        }}
                                      >
                                        Undo
                                      </button>
                                    )}
                                  </li>
                                ),
                              )}
                              {history.length === 0 && <li>No activity yet.</li>}
                            </ul>
                          </div>
                        </div>
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
