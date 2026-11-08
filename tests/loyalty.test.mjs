// Loyalty card tests. They run the real API handler against a real (in-memory) Postgres and try every way to cheat:
// fake orders, stamping one order twice, racing requests, replaying redemptions, guessing links, editing history.
// Run with: npm test
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import handler, { _resetLimits } from '../api/loyalty.js'
import { sealToken, openToken } from '../api/_lib/loyalty.js'
import { setSqlForTests } from '../api/_lib/db.js'
import { isAuthorized } from '../api/_lib/auth.js'
import {
  STAMPS_PER_REWARD, CARD_SLOTS, stampsForOrder, CHEAPEST_DRINK_PRICE, MAX_STAMPS_PER_ORDER,
  CARD_VALID_DAYS, addDays, todayInManila, normalizeDate, formatDate,
} from '../src/data/loyalty.js'

const KEY = 'test-admin-key-123'
process.env.ADMIN_KEY = KEY

let db
let sql

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`CREATE TABLE orders (
    id SERIAL PRIMARY KEY, order_number TEXT UNIQUE NOT NULL, items JSONB NOT NULL, total NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), payment_method TEXT, deleted_at TIMESTAMPTZ)`)
  // Same tagged-template shape as the Neon driver: sql`... ${value} ...` -> { rows, rowCount }
  sql = (strings, ...values) => {
    let text = ''
    strings.forEach((s, i) => {
      text += s
      if (i < values.length) text += '$' + (i + 1)
    })
    return db.query(text, values).then((r) => ({ rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }))
  }
  setSqlForTests(sql)
  _resetLimits()
})

// ---- helpers ---------------------------------------------------------------------------------------------------------
async function call(body, { key = KEY, ip = '1.2.3.4', method = 'POST' } = {}) {
  return new Promise((resolve) => {
    const res = {
      code: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v },
      status(c) { this.code = c; return this },
      json(o) { resolve({ code: this.code, body: o, headers: this.headers }) },
    }
    const headers = { 'x-forwarded-for': ip }
    if (key !== null) headers['x-admin-key'] = key
    handler({ method, body, headers, socket: {} }, res)
  })
}
async function addOrder(number, { qty = 1, total = 160, status = 'paid', items } = {}) {
  await db.query(`INSERT INTO orders (order_number, items, total, status) VALUES ($1, $2, $3, $4)`, [
    number, JSON.stringify(items || [{ name: 'Classic Matcha Latte', qty, unitPrice: 160 }]), total, status,
  ])
}
async function newCard(label = '@juan') {
  const r = await call({ action: 'create', label })
  assert.equal(r.code, 200)
  return { number: r.body.card.cardNumber, token: r.body.token }
}
async function stamp(cardNumber, orderNumber, opts) {
  return call({ action: 'stamp', cardNumber, orderNumber, staff: 'Ana' }, opts)
}
const balance = async (n) => Number((await db.query(`SELECT balance FROM loyalty_cards WHERE card_number = $1`, [n])).rows[0].balance)
// Give a card N stamps through the real API, one paid order each.
async function fill(cardNumber, n, prefix = 'MM-FILL') {
  for (let i = 0; i < n; i++) {
    await addOrder(`${prefix}-${i}`)
    assert.equal((await stamp(cardNumber, `${prefix}-${i}`)).code, 200)
  }
}

// ---- the card and its secret link --------------------------------------------------------------------------------------
test('the card has 10 slots and the 10th is the free drink, so 9 stamps earn it', () => {
  assert.equal(CARD_SLOTS, 10)
  assert.equal(STAMPS_PER_REWARD, 9)
})

test('a new card starts empty and its secret link works', async () => {
  const { number, token } = await newCard('Maria')
  assert.match(number, /^LC-[A-Z2-9]{4}$/)
  const v = await call({ action: 'view', token }, { key: null })
  assert.equal(v.code, 200)
  assert.equal(v.body.card.balance, 0)
  assert.equal(v.body.card.label, 'Maria')
  assert.equal(v.body.card.cardNumber, number)
})

test('the database never holds the link itself: a one-way hash, plus a copy only the admin key can open', async () => {
  const { token } = await newCard()
  const { rows } = await db.query(`SELECT token_hash, token_enc FROM loyalty_cards`)
  assert.notEqual(rows[0].token_hash, token)
  assert.equal(rows[0].token_hash.length, 64)
  assert.match(rows[0].token_enc, /^v1\./)
  assert.ok(!JSON.stringify((await db.query(`SELECT * FROM loyalty_cards`)).rows).includes(token))
})

test('guessing or malformed links all look the same: not found', async () => {
  await newCard()
  for (const token of ['', 'x', 'a'.repeat(22), 'a'.repeat(100), "' OR 1=1 --", null, undefined, 12345, { a: 1 }, '../../etc/passwd']) {
    const r = await call({ action: 'view', token }, { key: null })
    assert.equal(r.code, 404, 'token: ' + JSON.stringify(token))
    assert.deepEqual(r.body, { error: 'Card not found' })
  }
})

test('knowing a card NUMBER is not enough to see a card', async () => {
  const { number } = await newCard()
  const r = await call({ action: 'view', token: number }, { key: null })
  assert.equal(r.code, 404)
})

test('a new link replaces the old one at once', async () => {
  const { number, token } = await newCard()
  const r = await call({ action: 'regenerate', cardNumber: number })
  assert.equal(r.code, 200)
  assert.notEqual(r.body.token, token)
  assert.equal((await call({ action: 'view', token }, { key: null })).code, 404)
  assert.equal((await call({ action: 'view', token: r.body.token }, { key: null })).code, 200)
})

test('a disabled card stops working, and comes back when enabled', async () => {
  const { number, token } = await newCard()
  await addOrder('MM-1')
  await call({ action: 'disable', cardNumber: number })
  assert.equal((await call({ action: 'view', token }, { key: null })).code, 404)
  assert.equal((await stamp(number, 'MM-1')).code, 404)
  await call({ action: 'enable', cardNumber: number })
  assert.equal((await call({ action: 'view', token }, { key: null })).code, 200)
})

test('the view only ever returns that one card', async () => {
  const a = await newCard('A')
  await newCard('B')
  await fill(a.number, 2)
  const v = await call({ action: 'view', token: a.token }, { key: null })
  assert.equal(v.body.card.balance, 2)
  assert.deepEqual(Object.keys(v.body.card).sort(), ['balance', 'cardNumber', 'expired', 'expiresOn', 'history', 'label', 'rewardsReady', 'rewardsRedeemed'])
  assert.ok(!JSON.stringify(v.body).includes('B'.repeat(1) + '"')) // no second card's label
})

// ---- who is allowed to do what -------------------------------------------------------------------------------------------
test('every staff action is refused without the admin key', async () => {
  const { number, token } = await newCard()
  await addOrder('MM-1')
  for (const body of [
    { action: 'create', label: 'x' }, { action: 'search', q: '' }, { action: 'eligible' }, { action: 'ledger', cardNumber: number },
    { action: 'stamp', cardNumber: number, orderNumber: 'MM-1' }, { action: 'redeem', cardNumber: number },
    { action: 'void', entryId: 1 }, { action: 'regenerate', cardNumber: number }, { action: 'disable', cardNumber: number },
    { action: 'link', cardNumber: number }, { action: 'edit', cardNumber: number, label: 'Hacked' },
    { action: 'delete', cardNumber: number }, { action: 'restore', cardNumber: number },
    { action: 'edit', cardNumber: number, expiresOn: '2099-01-01' },
  ]) {
    // a different caller address each time, so the lockout (tested separately) does not get in the way
    const ip = () => '10.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250)
    assert.equal((await call(body, { key: null, ip: ip() })).code, 401, body.action + ' with no key')
    assert.equal((await call(body, { key: 'wrong', ip: ip() })).code, 401, body.action + ' with a wrong key')
    assert.equal((await call({ ...body, token }, { key: null, ip: ip() })).code, 401, body.action + ' with just the card link')
  }
  assert.equal(await balance(number), 0)
})

test('the admin key check is constant-time and strict', () => {
  const req = (k) => ({ headers: { 'x-admin-key': k } })
  assert.equal(isAuthorized(req(KEY)), true)
  assert.equal(isAuthorized(req('  ' + KEY + '\n')), true)
  for (const k of ['', 'x', KEY.slice(0, -1), KEY + 'x', KEY.toUpperCase(), undefined]) assert.equal(isAuthorized(req(k)), false)
  const saved = process.env.ADMIN_KEY
  process.env.ADMIN_KEY = ''
  assert.equal(isAuthorized(req('')), false, 'an unset key must never let an empty key in')
  process.env.ADMIN_KEY = saved
})

test('repeated wrong admin keys get locked out for a while', async () => {
  let last
  for (let i = 0; i < 25; i++) last = await call({ action: 'search', q: '' }, { key: 'nope', ip: '9.9.9.9' })
  assert.equal(last.code, 429)
  assert.equal((await call({ action: 'search', q: '' }, { ip: '8.8.8.8' })).code, 200, 'other callers are unaffected')
})

test('guessing card links is rate limited per caller', async () => {
  let last
  for (let i = 0; i < 65; i++) last = await call({ action: 'view', token: 'a'.repeat(22) }, { key: null, ip: '7.7.7.7' })
  assert.equal(last.code, 429)
})

test('only POST is accepted, and responses are never cached or indexed', async () => {
  const r = await call({}, { method: 'GET' })
  assert.equal(r.code, 405)
  const v = await call({ action: 'view', token: 'nope' }, { key: null })
  assert.equal(v.headers['Cache-Control'], 'no-store')
  assert.match(v.headers['X-Robots-Tag'], /noindex/)
})

// ---- stamps only come from real, paid orders -----------------------------------------------------------------------------
test('a paid order gives a stamp; an unknown, unpaid or trashed order does not', async () => {
  const { number } = await newCard()
  await addOrder('MM-PAID')
  await addOrder('MM-PEND', { status: 'pending' })
  await addOrder('MM-TRASH')
  await db.query(`UPDATE orders SET deleted_at = now() WHERE order_number = 'MM-TRASH'`)
  assert.equal((await stamp(number, 'MM-PAID')).code, 200)
  assert.equal((await stamp(number, 'MM-NOPE')).code, 404)
  assert.equal((await stamp(number, 'MM-PEND')).code, 409)
  assert.equal((await stamp(number, 'MM-TRASH')).code, 409)
  assert.equal(await balance(number), 1)
})

test('a fake order cannot farm stamps: an order earns no more than it paid for', async () => {
  const { number } = await newCard()
  await addOrder('MM-FAKE1', { qty: 8, total: 160 }) // claims 8 drinks, paid for 1
  assert.equal((await stamp(number, 'MM-FAKE1')).body.stamped, 1)
  await addOrder('MM-FAKE2', { qty: 5000, total: 100000 }) // huge claim, huge payment: still one card's worth at most
  assert.equal((await stamp(number, 'MM-FAKE2')).body.stamped, MAX_STAMPS_PER_ORDER)
  await addOrder('MM-FAKE3', { qty: 3, total: 50 }) // paid for nothing
  assert.equal((await stamp(number, 'MM-FAKE3')).code, 409)
  await addOrder('MM-FAKE4', { items: 'not even a list', total: 160 })
  assert.equal((await stamp(number, 'MM-FAKE4')).code, 200)
  assert.equal(stampsForOrder([{ qty: -5 }, { qty: 2.5 }, { qty: 'x' }], 160 * 10), 3)
  assert.equal(stampsForOrder([{ qty: 1 }], NaN), 0)
  assert.equal(stampsForOrder([{ qty: 4 }], 4 * CHEAPEST_DRINK_PRICE), 4)
})

test('one order can be stamped once, ever', async () => {
  const a = await newCard('A')
  const b = await newCard('B')
  await addOrder('MM-ONCE')
  assert.equal((await stamp(a.number, 'MM-ONCE')).code, 200)
  assert.equal((await stamp(a.number, 'MM-ONCE')).code, 409, 'same card again')
  assert.equal((await stamp(b.number, 'MM-ONCE')).code, 409, 'a different card')
  assert.equal(await balance(a.number), 1)
  assert.equal(await balance(b.number), 0)
})

test('flipping an order paid -> pending -> paid does not earn a second stamp', async () => {
  const { number } = await newCard()
  await addOrder('MM-FLIP')
  await stamp(number, 'MM-FLIP')
  await db.query(`UPDATE orders SET status = 'pending' WHERE order_number = 'MM-FLIP'`)
  await db.query(`UPDATE orders SET status = 'paid' WHERE order_number = 'MM-FLIP'`)
  assert.equal((await stamp(number, 'MM-FLIP')).code, 409)
  assert.equal(await balance(number), 1)
})

test('five requests racing to stamp the same order award exactly one stamp', async () => {
  const { number } = await newCard()
  await addOrder('MM-RACE', { qty: 3, total: 480 })
  const results = await Promise.all(Array.from({ length: 5 }, () => stamp(number, 'MM-RACE')))
  assert.equal(results.filter((r) => r.code === 200).length, 1)
  assert.equal(results.filter((r) => r.code === 409).length, 4)
  assert.equal(await balance(number), 3)
})

test('eligible orders hides stamped, unpaid and trashed orders', async () => {
  const { number } = await newCard()
  await addOrder('MM-A'); await addOrder('MM-B'); await addOrder('MM-C', { status: 'pending' }); await addOrder('MM-D')
  await db.query(`UPDATE orders SET deleted_at = now() WHERE order_number = 'MM-D'`)
  await stamp(number, 'MM-A')
  const r = await call({ action: 'eligible' })
  assert.deepEqual(r.body.orders.map((o) => o.orderNumber), ['MM-B'])
})

// ---- rewards -------------------------------------------------------------------------------------------------------------
test('a reward needs 9 stamps and cannot be taken early', async () => {
  const { number } = await newCard()
  await fill(number, 8)
  const early = await call({ action: 'redeem', cardNumber: number })
  assert.equal(early.code, 409)
  assert.match(early.body.error, /8 of 9/)
  assert.equal(await balance(number), 8)
  await fill(number, 1, 'MM-NINTH')
  assert.equal((await call({ action: 'redeem', cardNumber: number })).code, 200)
  assert.equal(await balance(number), 0)
})

test('redeeming twice in a row, or from two phones at once, gives one reward', async () => {
  const { number } = await newCard()
  await fill(number, 18) // enough for two rewards, so only the guard can stop a double
  const results = await Promise.all(Array.from({ length: 4 }, () => call({ action: 'redeem', cardNumber: number })))
  assert.equal(results.filter((r) => r.code === 200).length, 1)
  assert.equal(await balance(number), 9)
  // after a little time the second reward is allowed
  await db.query(`UPDATE loyalty_ledger SET created_at = now() - interval '1 minute' WHERE kind = 'redeem'`)
  assert.equal((await call({ action: 'redeem', cardNumber: number })).code, 200)
  assert.equal(await balance(number), 0)
})

test('the balance can never go negative, even by writing to it directly', async () => {
  const { number } = await newCard()
  await assert.rejects(db.query(`UPDATE loyalty_cards SET balance = -1 WHERE card_number = $1`, [number]))
})

// ---- mistakes are undone by adding, never by editing ---------------------------------------------------------------------
test('undoing a stamp removes it from the balance but not from the history', async () => {
  const { number } = await newCard()
  await addOrder('MM-OOPS')
  await stamp(number, 'MM-OOPS')
  const entry = (await call({ action: 'ledger', cardNumber: number })).body.entries[0]
  const v = await call({ action: 'void', entryId: entry.id, staff: 'Ana', note: 'wrong card' })
  assert.equal(v.code, 200)
  assert.equal(await balance(number), 0)
  const entries = (await call({ action: 'ledger', cardNumber: number })).body.entries
  assert.deepEqual(entries.map((e) => e.kind), ['void', 'stamp'])
  assert.equal(entries[0].note, 'wrong card')
})

test('a voided stamp cannot be re-earned by stamping the same order again, and cannot be voided twice', async () => {
  const { number } = await newCard()
  await addOrder('MM-V')
  await stamp(number, 'MM-V')
  const id = (await call({ action: 'ledger', cardNumber: number })).body.entries[0].id
  assert.equal((await call({ action: 'void', entryId: id })).code, 200)
  assert.equal((await call({ action: 'void', entryId: id })).code, 409)
  assert.equal((await stamp(number, 'MM-V')).code, 409)
  assert.equal(await balance(number), 0)
})

test('a stamp already spent on a reward cannot be undone until the reward is', async () => {
  const { number } = await newCard()
  await fill(number, 9)
  await call({ action: 'redeem', cardNumber: number })
  const stampId = (await db.query(`SELECT id FROM loyalty_ledger WHERE kind = 'stamp' ORDER BY id LIMIT 1`)).rows[0].id
  const bad = await call({ action: 'void', entryId: stampId })
  assert.equal(bad.code, 409)
  assert.equal(await balance(number), 0)
  // undoing the reward gives the 9 stamps back, and then the stamp can be undone
  const redeemId = (await db.query(`SELECT id FROM loyalty_ledger WHERE kind = 'redeem'`)).rows[0].id
  assert.equal((await call({ action: 'void', entryId: redeemId })).code, 200)
  assert.equal(await balance(number), 9)
  assert.equal((await db.query(`SELECT rewards_redeemed FROM loyalty_cards`)).rows[0].rewards_redeemed, 0)
  assert.equal((await call({ action: 'void', entryId: stampId })).code, 200)
  assert.equal(await balance(number), 8)
})

test('a void entry cannot itself be voided, and unknown entries are rejected', async () => {
  const { number } = await newCard()
  await addOrder('MM-Z')
  await stamp(number, 'MM-Z')
  const stampId = (await call({ action: 'ledger', cardNumber: number })).body.entries[0].id
  await call({ action: 'void', entryId: stampId })
  const voidId = (await call({ action: 'ledger', cardNumber: number })).body.entries[0].id
  assert.equal((await call({ action: 'void', entryId: voidId })).code, 404)
  for (const entryId of [0, -3, 999999, 'x', null, 1.5]) assert.ok([400, 404].includes((await call({ action: 'void', entryId })).code), 'entry ' + entryId)
})

test('the balance always equals the sum of the ledger', async () => {
  const { number } = await newCard()
  await fill(number, 12)
  await call({ action: 'redeem', cardNumber: number })
  const id = (await db.query(`SELECT id FROM loyalty_ledger WHERE kind = 'stamp' ORDER BY id DESC LIMIT 1`)).rows[0].id
  await call({ action: 'void', entryId: id })
  const { rows } = await db.query(`SELECT c.balance, COALESCE(SUM(l.stamps), 0) AS total FROM loyalty_cards c LEFT JOIN loyalty_ledger l ON l.card_id = c.id GROUP BY c.id`)
  assert.equal(Number(rows[0].balance), Number(rows[0].total))
})

// ---- hostile input -------------------------------------------------------------------------------------------------------
test('injection attempts in names, notes and numbers are stored as plain text or rejected', async () => {
  const nasty = "Robert'); DROP TABLE loyalty_cards;--"
  const { number } = await newCard(nasty)
  await addOrder('MM-I')
  assert.equal((await stamp(number, 'MM-I')).code, 200)
  await call({ action: 'stamp', cardNumber: number, orderNumber: "MM-I' OR '1'='1" })
  await call({ action: 'stamp', cardNumber: "LC-AAAA' OR 1=1", orderNumber: 'MM-I' })
  const { rows } = await db.query(`SELECT label FROM loyalty_cards`)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, nasty)
  assert.equal(await balance(number), 1)
  const s = await call({ action: 'search', q: "%' OR 1=1 --" })
  assert.equal(s.code, 200)
  assert.equal(s.body.cards.length, 0)
})

test('names and notes are trimmed, cleaned and length limited', async () => {
  const r = await call({ action: 'create', label: '  Ana\n\t Cruz \u0007 ' + 'x'.repeat(200) })
  assert.ok(r.body.card.label.length <= 60)
  assert.ok(!/[\u0000-\u001f]/.test(r.body.card.label))
  assert.equal((await call({ action: 'create', label: '   ' })).code, 400)
  assert.equal((await call({ action: 'create' })).code, 400)
})

test('search finds cards by name or number', async () => {
  const a = await newCard('Maria Santos')
  await newCard('Juan')
  assert.equal((await call({ action: 'search', q: 'santos' })).body.cards[0].cardNumber, a.number)
  assert.equal((await call({ action: 'search', q: a.number.toLowerCase() })).body.cards.length, 1)
  assert.equal((await call({ action: 'search', q: '' })).body.cards.length, 2)
})

test('unknown actions and non-object bodies are rejected without a crash', async () => {
  assert.equal((await call({ action: 'dropEverything' })).code, 400)
  assert.equal((await call(null)).code, 400)
  assert.equal((await call('a string')).code, 400)
  assert.equal((await call([1, 2])).code, 400)
})

// ---- seeing the link again, and fixing a name or number ---------------------------------------------------------------
test('staff can see a card\'s link again, and it opens that customer\'s card', async () => {
  const { number, token } = await newCard('Maria')
  const r = await call({ action: 'link', cardNumber: number })
  assert.equal(r.code, 200)
  assert.equal(r.body.token, token)
  assert.equal((await call({ action: 'view', token: r.body.token }, { key: null })).body.card.label, 'Maria')
})

test('a customer with only their own link cannot read links, and the number alone gets nothing', async () => {
  const { number, token } = await newCard()
  const other = await newCard('Other')
  assert.equal((await call({ action: 'link', cardNumber: other.number, token }, { key: null })).code, 401)
  assert.equal((await call({ action: 'link', cardNumber: number }, { key: 'wrong-key' })).code, 401)
  const bad = await call({ action: 'link', cardNumber: "LC-AAAA' OR 1=1" })
  assert.equal(bad.code, 400)
  assert.equal((await call({ action: 'link', cardNumber: 'LC-ZZZZ' })).code, 404)
})

test('a new link replaces the saved one, so staff always see the working link', async () => {
  const { number, token } = await newCard()
  const fresh = (await call({ action: 'regenerate', cardNumber: number })).body.token
  const r = await call({ action: 'link', cardNumber: number })
  assert.equal(r.body.token, fresh)
  assert.notEqual(r.body.token, token)
  assert.equal((await call({ action: 'view', token }, { key: null })).code, 404)
})

test('cards made before links were saved say so instead of showing nothing or crashing', async () => {
  const { number } = await newCard()
  await db.query(`UPDATE loyalty_cards SET token_enc = NULL`)
  const r = await call({ action: 'link', cardNumber: number })
  assert.equal(r.code, 200)
  assert.equal(r.body.token, null)
  assert.equal(r.body.reason, 'not-saved')
})

test('a saved link that was tampered with, moved to another card, or sealed with another key is reported unreadable', async () => {
  const a = await newCard('A')
  const b = await newCard('B')
  const encA = (await db.query(`SELECT token_enc FROM loyalty_cards WHERE card_number = $1`, [a.number])).rows[0].token_enc
  // 1) flipped bytes
  const parts = encA.split('.')
  const mangled = [parts[0], parts[1], parts[2], 'AAAA' + parts[3].slice(4)].join('.')
  await db.query(`UPDATE loyalty_cards SET token_enc = $1 WHERE card_number = $2`, [mangled, a.number])
  assert.equal((await call({ action: 'link', cardNumber: a.number })).body.reason, 'unreadable')
  // 2) A's sealed link copied onto B: it opens, but it is not B's link, so it is refused
  await db.query(`UPDATE loyalty_cards SET token_enc = $1 WHERE card_number = $2`, [encA, b.number])
  assert.equal((await call({ action: 'link', cardNumber: b.number })).body.reason, 'unreadable')
  // 3) the admin key was changed after the link was saved
  const keep = process.env.ADMIN_KEY
  try {
    process.env.ADMIN_KEY = 'a-completely-different-key'
    assert.equal(openToken(encA), null)
  } finally {
    process.env.ADMIN_KEY = keep
  }
})

test('sealing a link round-trips, differs every time, and saves nothing when no admin key is set', () => {
  const t = 'AbCdEfGhIjKlMnOpQrStUv'
  const one = sealToken(t)
  const two = sealToken(t)
  assert.notEqual(one, two)
  assert.ok(!one.includes(t))
  assert.equal(openToken(one), t)
  assert.equal(openToken('garbage'), null)
  assert.equal(openToken(null), null)
  assert.equal(openToken('v1.a.b.c'), null)
  const keep = process.env.ADMIN_KEY
  try {
    process.env.ADMIN_KEY = ''
    assert.equal(sealToken(t), null)
    assert.equal(openToken(one), null)
  } finally {
    process.env.ADMIN_KEY = keep
  }
})

test('fixing the name keeps the stamps, history and link, and is recorded', async () => {
  const { number, token } = await newCard('@jad')
  await fill(number, 3)
  const r = await call({ action: 'edit', cardNumber: number, label: '  @jade ', staff: 'Ana' })
  assert.equal(r.code, 200)
  assert.equal(r.body.changed, true)
  assert.equal(r.body.card.label, '@jade')
  const v = await call({ action: 'view', token }, { key: null })
  assert.equal(v.body.card.label, '@jade')
  assert.equal(v.body.card.balance, 3)
  assert.equal(v.body.card.history.length, 3)
  assert.equal((await call({ action: 'link', cardNumber: number })).body.token, token)
  const l = await call({ action: 'ledger', cardNumber: number })
  assert.equal(l.body.entries.length, 3)
  assert.equal(l.body.edits.length, 1)
  assert.deepEqual({ field: l.body.edits[0].field, old: l.body.edits[0].old_value, now: l.body.edits[0].new_value, staff: l.body.edits[0].staff },
    { field: 'name', old: '@jad', now: '@jade', staff: 'Ana' })
})

test('fixing the card number moves everything to the new number and retires the old one', async () => {
  const { number, token } = await newCard('Maria')
  await fill(number, 2)
  const r = await call({ action: 'edit', cardNumber: number, newCardNumber: ' lc-7k3q ', staff: 'Ana' })
  assert.equal(r.code, 200)
  assert.equal(r.body.card.cardNumber, 'LC-7K3Q')
  assert.equal(r.body.card.balance, 2)
  const v = await call({ action: 'view', token }, { key: null })
  assert.equal(v.body.card.cardNumber, 'LC-7K3Q')
  assert.equal(v.body.card.balance, 2)
  assert.equal((await call({ action: 'link', cardNumber: 'LC-7K3Q' })).body.token, token)
  await addOrder('MM-AFTER')
  assert.equal((await stamp(number, 'MM-AFTER')).code, 404, 'the old number no longer works')
  assert.equal((await stamp('LC-7K3Q', 'MM-AFTER')).code, 200)
  assert.equal(await balance('LC-7K3Q'), 3)
  const l = await call({ action: 'ledger', cardNumber: 'LC-7K3Q' })
  assert.equal(l.body.edits[0].field, 'number')
  assert.equal(l.body.edits[0].old_value, number)
  assert.equal(l.body.edits[0].new_value, 'LC-7K3Q')
})

test('changing name and number together records both', async () => {
  const { number } = await newCard('x')
  const r = await call({ action: 'edit', cardNumber: number, label: 'Maria Santos', newCardNumber: 'LC-2222', staff: 'Ben' })
  assert.equal(r.code, 200)
  const l = await call({ action: 'ledger', cardNumber: 'LC-2222' })
  assert.deepEqual(l.body.edits.map((e) => e.field).sort(), ['name', 'number'])
})

test('a mistyped number is rejected, and so is a number another card already has', async () => {
  const a = await newCard('A')
  const b = await newCard('B')
  for (const bad of ['LC-ABCO', 'LC-AB1C', 'LC-123', 'XX-ABCD', 'LC-ABCDE', 'lc7k3q', "LC-AAAA' OR 1=1", '<script>']) {
    const r = await call({ action: 'edit', cardNumber: a.number, newCardNumber: bad })
    assert.equal(r.code, 400, 'number: ' + bad)
  }
  const dup = await call({ action: 'edit', cardNumber: a.number, newCardNumber: b.number })
  assert.equal(dup.code, 409)
  assert.equal((await db.query(`SELECT card_number FROM loyalty_cards WHERE label = 'A'`)).rows[0].card_number, a.number)
  assert.equal((await db.query(`SELECT COUNT(*) AS n FROM loyalty_edits`)).rows[0].n, 0)
})

test('an empty name, nothing to change, and an unknown card are all refused cleanly', async () => {
  const { number } = await newCard('Maria')
  assert.equal((await call({ action: 'edit', cardNumber: number, label: '   ' })).code, 400)
  assert.equal((await call({ action: 'edit', cardNumber: number })).code, 400)
  assert.equal((await call({ action: 'edit', cardNumber: 'LC-ZZZZ', label: 'x' })).code, 404)
  assert.equal((await call({ action: 'edit', cardNumber: 'nonsense', label: 'x' })).code, 400)
  const same = await call({ action: 'edit', cardNumber: number, label: 'Maria', newCardNumber: number })
  assert.equal(same.code, 200)
  assert.equal(same.body.changed, false)
  assert.equal((await db.query(`SELECT COUNT(*) AS n FROM loyalty_edits`)).rows[0].n, 0)
})

test('names typed into an edit are cleaned and stored as plain text', async () => {
  const { number } = await newCard('x')
  const nasty = "Robert'); DROP TABLE loyalty_cards;--"
  const r = await call({ action: 'edit', cardNumber: number, label: nasty + '\n\t' + 'y'.repeat(200) })
  assert.equal(r.code, 200)
  assert.ok(r.body.card.label.length <= 60)
  assert.ok(!/[\u0000-\u001f]/.test(r.body.card.label))
  assert.equal((await db.query(`SELECT COUNT(*) AS n FROM loyalty_cards`)).rows[0].n, 1)
})

test('a disabled card can still be corrected, and editing never changes the balance or the ledger total', async () => {
  const { number } = await newCard('Ana')
  await fill(number, 4)
  await call({ action: 'disable', cardNumber: number })
  assert.equal((await call({ action: 'edit', cardNumber: number, label: 'Anna' })).code, 200)
  const { rows } = await db.query(`SELECT c.balance, COALESCE(SUM(l.stamps), 0) AS total FROM loyalty_cards c LEFT JOIN loyalty_ledger l ON l.card_id = c.id GROUP BY c.id`)
  assert.equal(Number(rows[0].balance), 4)
  assert.equal(Number(rows[0].total), 4)
})

// ---- who disabled a card, and when ---------------------------------------------------------------------------------------
test('disabling and enabling a card is recorded with who did it, once per real change', async () => {
  const { number } = await newCard('@jade')
  assert.equal((await call({ action: 'disable', cardNumber: number, staff: 'Ana' })).code, 200)
  assert.equal((await call({ action: 'disable', cardNumber: number, staff: 'Ben' })).code, 200) // already disabled: nothing to record
  assert.equal((await call({ action: 'enable', cardNumber: number, staff: 'Ben' })).code, 200)
  assert.equal((await call({ action: 'enable', cardNumber: number, staff: 'Cy' })).code, 200) // already enabled
  const l = await call({ action: 'ledger', cardNumber: number })
  const status = l.body.edits.filter((e) => e.field === 'status').map((e) => [e.old_value, e.new_value, e.staff])
  assert.deepEqual(status, [['disabled', 'enabled', 'Ben'], ['enabled', 'disabled', 'Ana']])
  assert.equal((await call({ action: 'disable', cardNumber: 'LC-ZZZZ' })).code, 404)
})

test('a disabled card really is off, and its stamps are untouched by being disabled and enabled', async () => {
  const { number, token } = await newCard()
  await fill(number, 3)
  await call({ action: 'disable', cardNumber: number, staff: 'Ana' })
  assert.equal((await call({ action: 'view', token }, { key: null })).code, 404)
  await call({ action: 'enable', cardNumber: number, staff: 'Ana' })
  const v = await call({ action: 'view', token }, { key: null })
  assert.equal(v.code, 200)
  assert.equal(v.body.card.balance, 3)
})

test('making a new link is recorded with who did it', async () => {
  const { number } = await newCard()
  await call({ action: 'regenerate', cardNumber: number, staff: 'Ana' })
  const l = await call({ action: 'ledger', cardNumber: number })
  assert.deepEqual(l.body.edits.map((e) => [e.field, e.new_value, e.staff]), [['link', 'new link made', 'Ana']])
})

test('a database made before status changes were recorded is upgraded in place', async () => {
  const { number } = await newCard()
  // put the table back the way it was when it only accepted name and number changes
  await db.exec(`ALTER TABLE loyalty_edits DROP CONSTRAINT IF EXISTS loyalty_edits_field_ok2`)
  await db.exec(`ALTER TABLE loyalty_edits DROP CONSTRAINT IF EXISTS loyalty_edits_field_ok`)
  await db.exec(`ALTER TABLE loyalty_edits DROP CONSTRAINT IF EXISTS loyalty_edits_field_check`)
  await db.exec(`ALTER TABLE loyalty_edits ADD CONSTRAINT loyalty_edits_field_check CHECK (field IN ('name', 'number'))`)
  await assert.rejects(db.query(`INSERT INTO loyalty_edits (card_id, field) VALUES (1, 'status')`))
  // a fresh server instance (it has not checked the tables yet) upgrades it the first time it is used
  const sql2 = (...args) => sql(...args)
  setSqlForTests(sql2)
  assert.equal((await call({ action: 'disable', cardNumber: number, staff: 'Ana' })).code, 200)
  assert.equal((await call({ action: 'edit', cardNumber: number, label: 'Still works' })).code, 200)
  assert.equal((await call({ action: 'ledger', cardNumber: number })).body.edits.length, 2)
})

// ---- card expiry ---------------------------------------------------------------------------------------------------------
const setExpiry = (number, date) => db.query(`UPDATE loyalty_cards SET expires_on = $1 WHERE card_number = $2`, [date, number])
const today = () => todayInManila()

test('the date helpers: plain calendar dates, validated, formatted, and counted in days', () => {
  assert.equal(normalizeDate('2027-11-08'), '2027-11-08')
  for (const bad of ['', null, undefined, '2027-13-01', '2027-02-30', '27-11-08', '2027/11/08', '2019-12-31', '2101-01-01', 'abc', '2027-11-08T00:00']) {
    assert.equal(normalizeDate(bad), null, String(bad))
  }
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2024-02-28', 1), '2024-02-29')
  assert.equal(addDays('2026-11-08', 365), '2027-11-08')
  assert.equal(formatDate('2027-11-08'), 'Nov 8, 2027')
  assert.equal(formatDate('nonsense'), '')
  assert.match(todayInManila(), /^\d{4}-\d{2}-\d{2}$/)
})

test('a new card is valid for a year by default, and the customer can see the date', async () => {
  const { number, token } = await newCard('Maria')
  const v = await call({ action: 'view', token }, { key: null })
  assert.equal(v.body.card.expiresOn, addDays(today(), CARD_VALID_DAYS))
  assert.equal(v.body.card.expired, false)
  const s = await call({ action: 'search', q: number })
  assert.equal(s.body.cards[0].expiresOn, addDays(today(), CARD_VALID_DAYS))
  assert.equal(s.body.cards[0].expired, false)
})

test('staff can choose the date when making a card, or choose no expiry, and bad dates are refused', async () => {
  const set = await call({ action: 'create', label: 'A', expiresOn: addDays(today(), 30) })
  assert.equal(set.body.card.expiresOn, addDays(today(), 30))
  const none = await call({ action: 'create', label: 'B', expiresOn: '' })
  assert.equal(none.body.card.expiresOn, null)
  assert.equal((await call({ action: 'view', token: none.body.token }, { key: null })).body.card.expired, false)
  assert.equal((await call({ action: 'create', label: 'C', expiresOn: null })).body.card.expiresOn, null)
  for (const bad of ['2027-02-30', 'tomorrow', '1999-01-01', "2027-01-01'; DROP TABLE loyalty_cards;--"]) {
    assert.equal((await call({ action: 'create', label: 'D', expiresOn: bad })).code, 400, bad)
  }
  assert.equal((await call({ action: 'create', label: 'E', expiresOn: addDays(today(), -1) })).code, 400, 'a date in the past')
  assert.equal((await db.query(`SELECT COUNT(*) AS n FROM loyalty_cards`)).rows[0].n, 3)
})

test('an expired card still opens, but cannot earn stamps or a free drink, and the message says why', async () => {
  const { number, token } = await newCard('Maria')
  await fill(number, 9)
  await setExpiry(number, addDays(today(), -1))
  const v = await call({ action: 'view', token }, { key: null })
  assert.equal(v.code, 200)
  assert.equal(v.body.card.expired, true)
  assert.equal(v.body.card.balance, 9)
  await addOrder('MM-LATE')
  const st = await stamp(number, 'MM-LATE')
  assert.equal(st.code, 409)
  assert.match(st.body.error, /expired on/)
  const rd = await call({ action: 'redeem', cardNumber: number })
  assert.equal(rd.code, 409)
  assert.match(rd.body.error, /expired on/)
  assert.equal(await balance(number), 9)
  assert.equal((await db.query(`SELECT rewards_redeemed FROM loyalty_cards`)).rows[0].rewards_redeemed, 0)
})

test('the last valid day still works, and the day after does not', async () => {
  const { number } = await newCard()
  await addOrder('MM-A')
  await addOrder('MM-B')
  await setExpiry(number, today())
  assert.equal((await stamp(number, 'MM-A')).code, 200)
  await setExpiry(number, addDays(today(), -1))
  assert.equal((await stamp(number, 'MM-B')).code, 409)
})

test('extending an expired card makes it work again, and the change is recorded', async () => {
  const { number, token } = await newCard('Maria')
  await fill(number, 9)
  await setExpiry(number, addDays(today(), -10))
  const next = addDays(today(), 90)
  const r = await call({ action: 'edit', cardNumber: number, expiresOn: next, staff: 'Ana' })
  assert.equal(r.code, 200)
  assert.equal(r.body.changed, true)
  assert.equal(r.body.card.expiresOn, next)
  assert.equal((await call({ action: 'view', token }, { key: null })).body.card.expired, false)
  assert.equal((await call({ action: 'redeem', cardNumber: number })).code, 200)
  const l = await call({ action: 'ledger', cardNumber: number })
  const e = l.body.edits.find((x) => x.field === 'expiry')
  assert.deepEqual([e.old_value, e.new_value, e.staff], [addDays(today(), -10), next, 'Ana'])
})

test('expiry can be removed or set to a past date by staff, and bad dates are refused without changing anything', async () => {
  const { number, token } = await newCard()
  assert.equal((await call({ action: 'edit', cardNumber: number, expiresOn: '' })).body.card.expiresOn, null)
  assert.equal((await call({ action: 'view', token }, { key: null })).body.card.expiresOn, null)
  const past = addDays(today(), -5)
  assert.equal((await call({ action: 'edit', cardNumber: number, expiresOn: past })).code, 200)
  assert.equal((await call({ action: 'view', token }, { key: null })).body.card.expired, true)
  for (const bad of ['2027-02-30', 'soon', '2101-01-01']) assert.equal((await call({ action: 'edit', cardNumber: number, expiresOn: bad })).code, 400, bad)
  assert.equal((await db.query(`SELECT expires_on::text AS d FROM loyalty_cards`)).rows[0].d, past)
  const same = await call({ action: 'edit', cardNumber: number, expiresOn: past })
  assert.equal(same.body.changed, false)
})

test('a stamp can still be undone on an expired card, and the balance rule still holds', async () => {
  const { number } = await newCard()
  await fill(number, 2)
  await setExpiry(number, addDays(today(), -1))
  const id = (await db.query(`SELECT id FROM loyalty_ledger WHERE kind = 'stamp' ORDER BY id DESC LIMIT 1`)).rows[0].id
  assert.equal((await call({ action: 'void', entryId: id })).code, 200)
  assert.equal(await balance(number), 1)
})

// ---- deleting a card -----------------------------------------------------------------------------------------------------
test('deleting a card hides it and turns it off, but keeps its stamps and history', async () => {
  const { number, token } = await newCard('@jade')
  await fill(number, 3)
  assert.equal((await call({ action: 'delete', cardNumber: number, staff: 'Ana' })).code, 200)
  assert.equal((await call({ action: 'search', q: '' })).body.cards.length, 0)
  assert.equal((await call({ action: 'view', token }, { key: null })).code, 404)
  await addOrder('MM-NEW')
  assert.equal((await stamp(number, 'MM-NEW')).code, 404)
  assert.equal((await call({ action: 'redeem', cardNumber: number })).code, 404)
  assert.equal((await call({ action: 'regenerate', cardNumber: number })).code, 404)
  assert.equal((await call({ action: 'disable', cardNumber: number })).code, 404)
  assert.equal((await call({ action: 'edit', cardNumber: number, label: 'x' })).code, 404)
  assert.equal((await call({ action: 'link', cardNumber: number })).body.reason, 'deleted')
  assert.equal(Number((await db.query(`SELECT COUNT(*) AS n FROM loyalty_cards`)).rows[0].n), 1, 'the row is still there')
  assert.equal(Number((await db.query(`SELECT COUNT(*) AS n FROM loyalty_ledger`)).rows[0].n), 3, 'and so is its history')
})

test('a deleted card can be found again and restored, with everything as it was', async () => {
  const { number, token } = await newCard('@jade')
  await fill(number, 4)
  await call({ action: 'delete', cardNumber: number, staff: 'Ana' })
  const shown = await call({ action: 'search', q: '', includeDeleted: true })
  assert.equal(shown.body.cards.length, 1)
  assert.equal(shown.body.cards[0].deleted, true)
  assert.equal((await call({ action: 'restore', cardNumber: number, staff: 'Ben' })).code, 200)
  const v = await call({ action: 'view', token }, { key: null })
  assert.equal(v.code, 200)
  assert.equal(v.body.card.balance, 4)
  assert.equal((await call({ action: 'search', q: '' })).body.cards[0].deleted, false)
  assert.equal((await call({ action: 'link', cardNumber: number })).body.token, token)
  const l = await call({ action: 'ledger', cardNumber: number })
  assert.deepEqual(l.body.edits.filter((e) => e.field === 'status').map((e) => [e.new_value, e.staff]), [['restored', 'Ben'], ['deleted', 'Ana']])
})

test('deleting twice records once, an unknown card is refused, and deleting never frees an order to be stamped again', async () => {
  const a = await newCard('A')
  await addOrder('MM-ONE')
  assert.equal((await stamp(a.number, 'MM-ONE')).code, 200)
  await call({ action: 'delete', cardNumber: a.number, staff: 'Ana' })
  await call({ action: 'delete', cardNumber: a.number, staff: 'Ben' })
  assert.equal((await call({ action: 'ledger', cardNumber: a.number })).body.edits.length, 1)
  assert.equal((await call({ action: 'delete', cardNumber: 'LC-ZZZZ' })).code, 404)
  const b = await newCard('B')
  const again = await stamp(b.number, 'MM-ONE')
  assert.equal(again.code, 409, 'the order stays used even though the card that used it was deleted')
  assert.match(again.body.error, /already been stamped/)
})

test('a deleted card keeps its number reserved, so nobody else can take it', async () => {
  const a = await newCard('A')
  const b = await newCard('B')
  await call({ action: 'delete', cardNumber: a.number })
  assert.equal((await call({ action: 'edit', cardNumber: b.number, newCardNumber: a.number })).code, 409)
})

test('the ledger total still equals the balance after expiry changes, deleting and restoring', async () => {
  const { number } = await newCard()
  await fill(number, 5)
  await call({ action: 'edit', cardNumber: number, expiresOn: addDays(today(), -2) })
  await call({ action: 'delete', cardNumber: number })
  await call({ action: 'restore', cardNumber: number })
  const { rows } = await db.query(`SELECT c.balance, COALESCE(SUM(l.stamps), 0) AS total FROM loyalty_cards c LEFT JOIN loyalty_ledger l ON l.card_id = c.id GROUP BY c.id`)
  assert.equal(Number(rows[0].balance), Number(rows[0].total))
})

test('a database made before expiry and deleting existed is upgraded in place and keeps its cards working', async () => {
  const { number, token } = await newCard('Old timer')
  await fill(number, 2)
  // the way the live tables looked before: no expiry or deleted columns, and an edit history that only knew four kinds of change
  await db.exec(`ALTER TABLE loyalty_cards DROP COLUMN expires_on, DROP COLUMN deleted_at`)
  await db.exec(`ALTER TABLE loyalty_edits DROP CONSTRAINT IF EXISTS loyalty_edits_field_ok2`)
  await db.exec(`ALTER TABLE loyalty_edits DROP CONSTRAINT IF EXISTS loyalty_edits_field_check`)
  await db.exec(`ALTER TABLE loyalty_edits ADD CONSTRAINT loyalty_edits_field_ok CHECK (field IN ('name', 'number', 'status', 'link'))`)
  await assert.rejects(db.query(`INSERT INTO loyalty_edits (card_id, field) VALUES (1, 'expiry')`))
  setSqlForTests((...args) => sql(...args)) // a fresh server instance that has not checked the tables yet
  const v = await call({ action: 'view', token }, { key: null })
  assert.equal(v.code, 200)
  assert.equal(v.body.card.balance, 2)
  assert.equal(v.body.card.expiresOn, null, 'an old card gets no expiry, so no existing customer is suddenly locked out')
  assert.equal(v.body.card.expired, false)
  assert.equal((await call({ action: 'edit', cardNumber: number, expiresOn: addDays(today(), 60) })).code, 200)
  assert.equal((await call({ action: 'delete', cardNumber: number })).code, 200)
  assert.equal((await call({ action: 'restore', cardNumber: number })).code, 200)
})
