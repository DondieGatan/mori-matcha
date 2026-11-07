import { createHash, timingSafeEqual } from 'node:crypto'

// Trims both sides so stray whitespace/newlines from copy-pasting the key
// into the Vercel dashboard (or sending it from a client) don't cause a
// false mismatch. The comparison is constant-time: both sides are hashed to the
// same length first, so how long the guess takes never reveals how much of it was right.
export function isAuthorized(req) {
  const provided = String(req.headers['x-admin-key'] || '').trim()
  const expected = (process.env.ADMIN_KEY || '').trim()
  if (!expected) return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}
