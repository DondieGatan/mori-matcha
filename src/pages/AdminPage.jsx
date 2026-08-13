import { useCallback, useEffect, useState } from 'react'
import { FEATURED_DRINK, MENU_DRINKS, formatPeso } from '../data/menu'

const ADMIN_KEY_STORAGE = 'mori-matcha-admin-key'
const STATUSES = ['pending', 'paid', 'shipped']
const PAYMENT_METHODS = ['GCash', 'BDO', 'Maya', 'Cash']
const ALL_DRINKS = [FEATURED_DRINK, ...MENU_DRINKS]

function formatTimestamp(iso) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function formatItems(items) {
  return items
    .map((item) => {
      let detail = item.level + ' sugar'
      if (item.milk && item.milk !== 'Regular Milk') detail += ', ' + item.milk
      return item.qty + 'x ' + item.name + ' (' + detail + ')'
    })
    .join('; ')
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function downloadOrdersCsv(orders) {
  const header = ['Timestamp', 'Order Number', 'Items', 'Total', 'Status', 'Payment Method']
  const rows = orders.map((o) => [
    formatTimestamp(o.created_at),
    o.order_number,
    formatItems(o.items),
    Number(o.total),
    o.status,
    o.payment_method || '',
  ])
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mori-matcha-orders-' + new Date().toISOString().slice(0, 10) + '.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(() => {
    try {
      return localStorage.getItem(ADMIN_KEY_STORAGE) || ''
    } catch (e) {
      return ''
    }
  })
  const [keyInput, setKeyInput] = useState('')
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [soldOutKeys, setSoldOutKeys] = useState([])

  const loadOrders = useCallback(async (key) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/orders', { headers: { 'X-Admin-Key': key } })
      if (res.status === 401) {
        setError('Wrong admin key.')
        setOrders(null)
        try {
          localStorage.removeItem(ADMIN_KEY_STORAGE)
        } catch (e) {}
        setAdminKey('')
        return
      }
      if (!res.ok) {
        setError('Failed to load orders.')
        return
      }
      const data = await res.json()
      setOrders(data.orders)
    } catch (e) {
      setError('Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAvailability = useCallback(async () => {
    try {
      const res = await fetch('/api/availability')
      if (!res.ok) return
      const data = await res.json()
      setSoldOutKeys(data.soldOut || [])
    } catch (e) {}
  }, [])

  useEffect(() => {
    if (adminKey) {
      loadOrders(adminKey)
      loadAvailability()
    }
  }, [adminKey, loadOrders, loadAvailability])

  async function handleAvailabilityToggle(drinkKey, available) {
    setSoldOutKeys((prev) => (available ? prev.filter((k) => k !== drinkKey) : [...prev, drinkKey]))
    try {
      const res = await fetch('/api/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ drinkKey, available }),
      })
      if (!res.ok) throw new Error('failed')
    } catch (e) {
      setError('Failed to update availability for ' + drinkKey + ' — refresh and try again.')
    }
  }

  function handleKeySubmit(e) {
    e.preventDefault()
    if (!keyInput) return
    try {
      localStorage.setItem(ADMIN_KEY_STORAGE, keyInput)
    } catch (e) {}
    setAdminKey(keyInput)
  }

  async function handleStatusChange(orderNumber, status) {
    setOrders((prev) => prev.map((o) => (o.order_number === orderNumber ? { ...o, status } : o)))
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(orderNumber), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('failed')
    } catch (e) {
      setError('Failed to update status for ' + orderNumber + ' — refresh and try again.')
    }
  }

  async function handlePaymentMethodChange(orderNumber, paymentMethod) {
    setOrders((prev) => prev.map((o) => (o.order_number === orderNumber ? { ...o, payment_method: paymentMethod } : o)))
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(orderNumber), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ paymentMethod: paymentMethod || null }),
      })
      if (!res.ok) throw new Error('failed')
    } catch (e) {
      setError('Failed to update payment method for ' + orderNumber + ' — refresh and try again.')
    }
  }

  async function handleDelete(orderNumber) {
    if (!window.confirm('Delete order ' + orderNumber + '? This cannot be undone.')) return
    const previous = orders
    setOrders((prev) => prev.filter((o) => o.order_number !== orderNumber))
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(orderNumber), {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey },
      })
      if (!res.ok) throw new Error('failed')
    } catch (e) {
      setOrders(previous)
      setError('Failed to delete ' + orderNumber + ' — try again.')
    }
  }

  if (!adminKey) {
    return (
      <div className="admin-page">
        <form className="admin-key-form" onSubmit={handleKeySubmit}>
          <h1>Mori Matcha — Admin</h1>
          <label htmlFor="admin-key-input">Admin key</label>
          <input
            id="admin-key-input"
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            Enter
          </button>
          {error && <p className="admin-error">{error}</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-availability">
        <h2>Menu Availability</h2>
        <div className="admin-availability-list">
          {ALL_DRINKS.map((drink) => {
            const available = !soldOutKeys.includes(drink.key)
            return (
              <label key={drink.key} className="admin-availability-item">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => handleAvailabilityToggle(drink.key, e.target.checked)}
                />
                {drink.name}
              </label>
            )
          })}
        </div>
      </div>

      <div className="admin-header">
        <h1>Mori Matcha — Orders</h1>
        <div className="admin-header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => downloadOrdersCsv(orders || [])}
            disabled={!orders || orders.length === 0}
          >
            Download CSV
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => loadOrders(adminKey)} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {orders && orders.length === 0 && <p>No orders yet.</p>}
      {orders && orders.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Order #</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_number}>
                  <td>{formatTimestamp(order.created_at)}</td>
                  <td>{order.order_number}</td>
                  <td>{formatItems(order.items)}</td>
                  <td>{formatPeso(Number(order.total))}</td>
                  <td>
                    <select
                      className="admin-status-select"
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.order_number, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="admin-status-select"
                      value={order.payment_method || ''}
                      onChange={(e) => handlePaymentMethodChange(order.order_number, e.target.value)}
                    >
                      <option value="">—</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-delete-btn"
                      aria-label={'Delete order ' + order.order_number}
                      onClick={() => handleDelete(order.order_number)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
