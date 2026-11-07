import { neon } from '@neondatabase/serverless'

// One place that hands out the database connection, so tests can swap in a throwaway Postgres.
let override = null
let real = null

export function setSqlForTests(fn) {
  override = fn
}

export function getSql() {
  if (override) return override
  if (!real) real = neon(process.env.DATABASE_URL, { fullResults: true })
  return real
}
