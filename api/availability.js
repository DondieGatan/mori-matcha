import { neon } from '@neondatabase/serverless'
import { isAuthorized } from './_lib/auth.js'

const sql = neon(process.env.DATABASE_URL, { fullResults: true })

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS availability (
      drink_key TEXT PRIMARY KEY,
      available BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
}

// A drink with no row here is assumed available -- rows only need to exist
// for drinks that have been explicitly marked sold out.
export default async function handler(req, res) {
  await ensureTable()

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT drink_key FROM availability WHERE available = false`
    return res.status(200).json({ soldOut: rows.map((r) => r.drink_key) })
  }

  if (req.method === 'PATCH') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { drinkKey, available } = req.body || {}
    if (!drinkKey || typeof available !== 'boolean') {
      return res.status(400).json({ error: 'drinkKey and available (boolean) are required' })
    }
    await sql`
      INSERT INTO availability (drink_key, available, updated_at)
      VALUES (${drinkKey}, ${available}, now())
      ON CONFLICT (drink_key) DO UPDATE SET available = ${available}, updated_at = now()
    `
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', ['GET', 'PATCH'])
  return res.status(405).end('Method Not Allowed')
}
