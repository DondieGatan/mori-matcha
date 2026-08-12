import { useCallback, useEffect, useState } from 'react'
import { formatPeso } from '../data/menu'

const ADMIN_KEY_STORAGE = 'mori-matcha-admin-key'
const STATUSES = ['pending', 'paid', 'shipped']

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

  useEffect(() => {
    if (adminKey) loadOrders(adminKey)
  }, [adminKey, loadOrders])

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
      <div className="admin-header">
        <h1>Mori Matcha — Orders</h1>
        <button type="button" className="btn btn-ghost" onClick={() => loadOrders(adminKey)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
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
