import { neon } from '@neondatabase/serverless'
import { isAuthorized } from '../_lib/auth.js'

const sql = neon(process.env.DATABASE_URL, { fullResults: true })

const ALLOWED_STATUSES = ['pending', 'paid', 'shipped']
const ALLOWED_PAYMENT_METHODS = ['GCash', 'BDO', 'Maya', 'Cash']

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['PATCH', 'DELETE'])
    return res.status(405).end('Method Not Allowed')
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { orderNumber } = req.query

  if (req.method === 'DELETE') {
    const { rowCount } = await sql`DELETE FROM orders WHERE order_number = ${orderNumber}`
    if (rowCount === 0) return res.status(404).json({ error: 'Order not found' })
    return res.status(200).json({ ok: true })
  }

  const { status, paymentMethod } = req.body || {}

  if (status === undefined && paymentMethod === undefined) {
    return res.status(400).json({ error: 'Provide status and/or paymentMethod' })
  }
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  if (paymentMethod !== undefined && paymentMethod !== null && !ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: 'Invalid paymentMethod' })
  }

  const { rowCount } = await sql`
    UPDATE orders SET
      status = COALESCE(${status ?? null}, status),
      payment_method = CASE WHEN ${paymentMethod !== undefined} THEN ${paymentMethod ?? null} ELSE payment_method END,
      updated_at = now()
    WHERE order_number = ${orderNumber}
  `

  if (rowCount === 0) return res.status(404).json({ error: 'Order not found' })
  return res.status(200).json({ ok: true })
}
