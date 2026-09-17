import { neon } from '@neondatabase/serverless'
import { isAuthorized } from './_lib/auth.js'

const sql = neon(process.env.DATABASE_URL, { fullResults: true })

const STATUSES = ['available', 'unavailable', 'coming_soon']

// The migration below is idempotent but not free — skip it once it has
// already succeeded on this warm serverless instance, since the client now
// polls this endpoint every few seconds and would otherwise re-run six
// queries' worth of schema checks on every single poll.
let migrated = false

async function ensureTable() {
  if (migrated) return
  await sql`
    CREATE TABLE IF NOT EXISTS availability (
      drink_key TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'available',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  // Migrates a pre-existing table from the old boolean `available` column
  // (true/false) to `status` — additive and idempotent, safe to run on
  // every cold start even once every row has already been migrated.
  await sql`ALTER TABLE availability ADD COLUMN IF NOT EXISTS status TEXT`
  await sql`
    UPDATE availability SET status = CASE WHEN available THEN 'available' ELSE 'unavailable' END
    WHERE status IS NULL AND available IS NOT NULL
  `.catch(() => {})
  await sql`UPDATE availability SET status = 'available' WHERE status IS NULL`
  await sql`ALTER TABLE availability ALTER COLUMN status SET DEFAULT 'available'`
  await sql`ALTER TABLE availability ALTER COLUMN status SET NOT NULL`
  await sql`ALTER TABLE availability DROP COLUMN IF EXISTS available`
  migrated = true
}

// A drink with no row here is assumed available -- rows only need to exist
// for drinks that have been explicitly marked unavailable or coming soon.
export default async function handler(req, res) {
  await ensureTable()

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT drink_key, status FROM availability WHERE status != 'available'`
    const statuses = {}
    for (const r of rows) statuses[r.drink_key] = r.status
    return res.status(200).json({ statuses })
  }

  if (req.method === 'PATCH') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { drinkKey, status } = req.body || {}
    if (!drinkKey || !STATUSES.includes(status)) {
      return res.status(400).json({ error: 'drinkKey and a valid status (available, unavailable, coming_soon) are required' })
    }
    await sql`
      INSERT INTO availability (drink_key, status, updated_at)
      VALUES (${drinkKey}, ${status}, now())
      ON CONFLICT (drink_key) DO UPDATE SET status = ${status}, updated_at = now()
    `
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', ['GET', 'PATCH'])
  return res.status(405).end('Method Not Allowed')
}
