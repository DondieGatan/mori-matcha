import { neon } from '@neondatabase/serverless'
import { isAuthorized } from './_lib/auth.js'

const sql = neon(process.env.DATABASE_URL, { fullResults: true })

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      items JSONB NOT NULL,
      total NUMERIC NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
}

export default async function handler(req, res) {
  await ensureTable()

  if (req.method === 'POST') {
    const { orderNumber, items, total } = req.body || {}
    if (!orderNumber || !Array.isArray(items) || items.length === 0 || typeof total !== 'number') {
      return res.status(400).json({ error: 'orderNumber, items (array), and total (number) are required' })
    }

    try {
      await sql`
        INSERT INTO orders (order_number, items, total)
        VALUES (${orderNumber}, ${JSON.stringify(items)}, ${total})
        ON CONFLICT (order_number) DO NOTHING
      `
      return res.status(201).json({ orderNumber })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save order' })
    }
  }

  if (req.method === 'GET') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { rows } = await sql`SELECT * FROM orders ORDER BY created_at DESC`
    return res.status(200).json({ orders: rows })
  }

  res.setHeader('Allow', ['POST', 'GET'])
  return res.status(405).end('Method Not Allowed')
}
