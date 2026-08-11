// Trims both sides so stray whitespace/newlines from copy-pasting the key
// into the Vercel dashboard (or sending it from a client) don't cause a
// false mismatch.
export function isAuthorized(req) {
  const provided = (req.headers['x-admin-key'] || '').trim()
  const expected = (process.env.ADMIN_KEY || '').trim()
  return Boolean(expected) && provided === expected
}
