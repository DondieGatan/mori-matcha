import { getSql } from './_lib/db.js'
import { isAuthorized } from './_lib/auth.js'
import * as loyalty from './_lib/loyalty.js'

// One endpoint for the loyalty card. Everything is POST with a JSON body, so the secret card token never appears in a URL,
// a server log or a referrer. "view" is the only action a customer can use (it needs their secret token); every other action
// needs the staff admin key.

const WINDOW_MS = 10 * 60 * 1000
const buckets = { view: new Map(), failedAuth: new Map() }
const LIMITS = { view: 60, failedAuth: 20 }

// Best-effort flood guard: each warm serverless instance remembers recent callers. It cannot see other instances, so it
// slows guessing down rather than being a hard cap; the card token (128 random bits) and the admin key are the real defence.
function overLimit(bucket, ip, count = true) {
  const map = buckets[bucket]
  const now = Date.now()
  const recent = (map.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  if (count) recent.push(now)
  map.set(ip, recent)
  if (map.size > 5000) for (const [k, v] of map) if (!v.some((t) => now - t < WINDOW_MS)) map.delete(k)
  return recent.length > LIMITS[bucket]
}

const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'

function send(res, result) {
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  const { ok, ...rest } = result
  return res.status(200).json({ ok: true, ...rest })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const ip = clientIp(req)
  const sql = getSql()

  try {
    if (body.action === 'view') {
      if (overLimit('view', ip)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' })
      return send(res, await loyalty.viewCard(sql, body.token))
    }

    if (overLimit('failedAuth', ip, false)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' })
    if (!isAuthorized(req)) {
      overLimit('failedAuth', ip)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    switch (body.action) {
      case 'create':
        return send(res, await loyalty.createCard(sql, body))
      case 'search':
        return send(res, await loyalty.searchCards(sql, body))
      case 'eligible':
        return send(res, await loyalty.eligibleOrders(sql))
      case 'ledger':
        return send(res, await loyalty.cardLedger(sql, body))
      case 'stamp':
        return send(res, await loyalty.stampCard(sql, body))
      case 'redeem':
        return send(res, await loyalty.redeemReward(sql, body))
      case 'void':
        return send(res, await loyalty.voidEntry(sql, body))
      case 'regenerate':
        return send(res, await loyalty.regenerateLink(sql, body))
      case 'link':
        return send(res, await loyalty.cardLink(sql, body))
      case 'delete':
        return send(res, await loyalty.setCardDeleted(sql, { cardNumber: body.cardNumber, deleted: true, staff: body.staff }))
      case 'restore':
        return send(res, await loyalty.setCardDeleted(sql, { cardNumber: body.cardNumber, deleted: false, staff: body.staff }))
      case 'edit':
        return send(res, await loyalty.editCard(sql, body))
      case 'disable':
        return send(res, await loyalty.setCardDisabled(sql, { cardNumber: body.cardNumber, disabled: true, staff: body.staff }))
      case 'enable':
        return send(res, await loyalty.setCardDisabled(sql, { cardNumber: body.cardNumber, disabled: false, staff: body.staff }))
      default:
        return res.status(400).json({ error: 'Unknown action' })
    }
  } catch (err) {
    console.error('loyalty error', err && err.message)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}

// Exported for tests.
export const _resetLimits = () => {
  buckets.view.clear()
  buckets.failedAuth.clear()
}
