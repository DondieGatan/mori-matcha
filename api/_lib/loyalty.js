// Loyalty card engine. The server is the only place a stamp can come from, and every change is a row in an append-only
// ledger. Each rule that stops cheating is enforced here, in the database, not in the browser:
//  - a stamp needs a real order the café has marked paid, and an order can be stamped once, ever (unique index)
//  - an order's stamps are capped by what was paid at the cheapest drink, so a fake "8 drinks for 1 peso" order earns 1
//  - a reward needs enough stamps, is taken in the same statement that checks them, and a double click cannot take two
//  - the card's secret link is random (128 bits) and only its hash is stored, so a database leak does not leak links
//  - a mistake is undone with a reversing entry (a "void"), never by editing or deleting history
import { createHash, randomBytes, randomInt } from 'node:crypto'
import {
  CARD_NUMBER_ALPHABET,
  CARD_NUMBER_PATTERN,
  STAMPS_PER_REWARD,
  stampsForOrder,
} from '../../src/data/loyalty.js'

const ready = new WeakSet()

export async function ensureTables(sql) {
  if (ready.has(sql)) return
  await sql`
    CREATE TABLE IF NOT EXISTS loyalty_cards (
      id SERIAL PRIMARY KEY,
      card_number TEXT UNIQUE NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
      rewards_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (rewards_redeemed >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      disabled_at TIMESTAMPTZ
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS loyalty_ledger (
      id SERIAL PRIMARY KEY,
      card_id INTEGER NOT NULL REFERENCES loyalty_cards(id),
      kind TEXT NOT NULL CHECK (kind IN ('stamp', 'redeem', 'void')),
      stamps INTEGER NOT NULL,
      order_number TEXT,
      voids_id INTEGER,
      staff TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS loyalty_one_stamp_per_order ON loyalty_ledger (order_number) WHERE kind = 'stamp'`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS loyalty_one_void_per_entry ON loyalty_ledger (voids_id) WHERE kind = 'void'`
  await sql`CREATE INDEX IF NOT EXISTS loyalty_ledger_card ON loyalty_ledger (card_id, id DESC)`
  ready.add(sql)
}

const fail = (status, error) => ({ ok: false, status, error })
const hashToken = (token) => createHash('sha256').update(token).digest('hex')
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export function normalizeCardNumber(input) {
  const n = String(input ?? '').toUpperCase().replace(/\s+/g, '')
  return CARD_NUMBER_PATTERN.test(n) ? n : null
}

function newCardNumber() {
  let s = ''
  for (let i = 0; i < 4; i++) s += CARD_NUMBER_ALPHABET[randomInt(CARD_NUMBER_ALPHABET.length)]
  return 'LC-' + s
}

const newToken = () => randomBytes(16).toString('base64url') // 128 bits, 22 characters

// ---------------------------------------------------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------------------------------------------------

// The customer's own card, found by its secret token. Anything wrong with the token looks the same: not found.
export async function viewCard(sql, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return fail(404, 'Card not found')
  await ensureTables(sql)
  const { rows } = await sql`
    SELECT id, card_number, label, balance, rewards_redeemed
    FROM loyalty_cards WHERE token_hash = ${hashToken(token)} AND disabled_at IS NULL
  `
  if (rows.length === 0) return fail(404, 'Card not found')
  const c = rows[0]
  const { rows: history } = await sql`
    SELECT kind, stamps, created_at FROM loyalty_ledger WHERE card_id = ${c.id} ORDER BY id DESC LIMIT 12
  `
  return {
    ok: true,
    card: {
      cardNumber: c.card_number,
      label: c.label,
      balance: c.balance,
      rewardsReady: Math.floor(c.balance / STAMPS_PER_REWARD),
      rewardsRedeemed: c.rewards_redeemed,
      history: history.map((h) => ({ kind: h.kind, stamps: h.stamps, at: h.created_at })),
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Staff side (every function below is only reachable with the admin key; see api/loyalty.js)
// ---------------------------------------------------------------------------------------------------------------------

export async function createCard(sql, { label }) {
  const name = clean(label, 60)
  if (!name) return fail(400, 'Enter the customer name or Instagram handle')
  await ensureTables(sql)
  const token = newToken()
  for (let attempt = 0; attempt < 8; attempt++) {
    const cardNumber = newCardNumber()
    const { rows } = await sql`
      INSERT INTO loyalty_cards (card_number, token_hash, label)
      VALUES (${cardNumber}, ${hashToken(token)}, ${name})
      ON CONFLICT (card_number) DO NOTHING
      RETURNING card_number, label, balance
    `
    if (rows.length) return { ok: true, card: { cardNumber: rows[0].card_number, label: rows[0].label, balance: 0 }, token }
  }
  return fail(500, 'Could not create a card number, please try again')
}

export async function searchCards(sql, { q }) {
  await ensureTables(sql)
  const term = '%' + clean(q, 40).replace(/[\\%_]/g, '\\$&') + '%'
  const { rows } = await sql`
    SELECT card_number, label, balance, rewards_redeemed, created_at, disabled_at
    FROM loyalty_cards
    WHERE card_number ILIKE ${term} OR label ILIKE ${term}
    ORDER BY created_at DESC LIMIT 50
  `
  return {
    ok: true,
    cards: rows.map((c) => ({
      cardNumber: c.card_number,
      label: c.label,
      balance: c.balance,
      rewardsReady: Math.floor(c.balance / STAMPS_PER_REWARD),
      rewardsRedeemed: c.rewards_redeemed,
      createdAt: c.created_at,
      disabled: Boolean(c.disabled_at),
    })),
  }
}

// Paid orders that have not been stamped yet, newest first, with how many stamps each would earn.
export async function eligibleOrders(sql) {
  await ensureTables(sql)
  const { rows } = await sql`
    SELECT o.order_number, o.items, o.total, o.created_at
    FROM orders o
    WHERE o.status IN ('paid', 'shipped') AND o.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM loyalty_ledger l WHERE l.kind = 'stamp' AND l.order_number = o.order_number)
    ORDER BY o.created_at DESC LIMIT 50
  `
  return {
    ok: true,
    orders: rows.map((o) => ({
      orderNumber: o.order_number,
      items: o.items,
      total: Number(o.total),
      createdAt: o.created_at,
      stamps: stampsForOrder(o.items, Number(o.total)),
    })),
  }
}

export async function cardLedger(sql, { cardNumber }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  await ensureTables(sql)
  const { rows } = await sql`
    SELECT l.id, l.kind, l.stamps, l.order_number, l.voids_id, l.staff, l.note, l.created_at
    FROM loyalty_ledger l JOIN loyalty_cards c ON c.id = l.card_id
    WHERE c.card_number = ${number} ORDER BY l.id DESC LIMIT 60
  `
  return { ok: true, entries: rows }
}

export async function stampCard(sql, { cardNumber, orderNumber, staff, note }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  const order = clean(orderNumber, 40)
  if (!/^[A-Za-z0-9-]{3,40}$/.test(order)) return fail(400, 'That is not a valid order number')
  await ensureTables(sql)

  const { rows: found } = await sql`SELECT items, total, status, deleted_at FROM orders WHERE order_number = ${order}`
  if (found.length === 0) return fail(404, 'No order with that number')
  const o = found[0]
  if (o.deleted_at) return fail(409, 'That order is in the trash')
  if (o.status !== 'paid' && o.status !== 'shipped') return fail(409, 'Mark the order as paid first')
  const stamps = stampsForOrder(o.items, Number(o.total))
  if (stamps < 1) return fail(409, 'The order total is too small to earn a stamp')

  // One statement: it checks the card and the paid order again, inserts the ledger row, and raises the balance. The unique
  // index on order_number means a second attempt for the same order inserts nothing, even if two arrive at the same moment.
  const { rows } = await sql`
    WITH ins AS (
      INSERT INTO loyalty_ledger (card_id, kind, stamps, order_number, staff, note)
      SELECT c.id, 'stamp', ${stamps}::int, ${order}::text, ${clean(staff, 40) || null}::text, ${clean(note, 120) || null}::text
      FROM loyalty_cards c
      WHERE c.card_number = ${number} AND c.disabled_at IS NULL
        AND EXISTS (SELECT 1 FROM orders o WHERE o.order_number = ${order} AND o.deleted_at IS NULL AND o.status IN ('paid', 'shipped'))
      ON CONFLICT (order_number) WHERE kind = 'stamp' DO NOTHING
      RETURNING card_id, stamps
    ), upd AS (
      UPDATE loyalty_cards c SET balance = c.balance + ins.stamps FROM ins WHERE c.id = ins.card_id
      RETURNING c.card_number, c.label, c.balance
    )
    SELECT card_number, label, balance FROM upd
  `
  if (rows.length === 0) {
    const { rows: used } = await sql`SELECT 1 FROM loyalty_ledger WHERE kind = 'stamp' AND order_number = ${order}`
    if (used.length) return fail(409, 'That order has already been stamped')
    return fail(404, 'No active card with that number')
  }
  return { ok: true, stamped: stamps, card: { cardNumber: rows[0].card_number, label: rows[0].label, balance: rows[0].balance } }
}

export async function redeemReward(sql, { cardNumber, staff, note }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  await ensureTables(sql)
  // The balance check, the deduction and the ledger row are one statement. A second redemption in the same few seconds
  // (a double click, or two staff phones) finds the balance already spent, or the recent redemption, and gets nothing.
  const { rows } = await sql`
    WITH upd AS (
      UPDATE loyalty_cards c
      SET balance = c.balance - ${STAMPS_PER_REWARD}::int, rewards_redeemed = c.rewards_redeemed + 1
      WHERE c.card_number = ${number} AND c.disabled_at IS NULL AND c.balance >= ${STAMPS_PER_REWARD}::int
        AND NOT EXISTS (
          SELECT 1 FROM loyalty_ledger l WHERE l.card_id = c.id AND l.kind = 'redeem' AND l.created_at > now() - interval '10 seconds'
        )
      RETURNING c.id, c.card_number, c.label, c.balance
    ), ins AS (
      INSERT INTO loyalty_ledger (card_id, kind, stamps, staff, note)
      SELECT id, 'redeem', -${STAMPS_PER_REWARD}::int, ${clean(staff, 40) || null}::text, ${clean(note, 120) || null}::text FROM upd
      RETURNING id
    )
    SELECT card_number, label, balance FROM upd
  `
  if (rows.length === 0) {
    const { rows: c } = await sql`SELECT balance, disabled_at FROM loyalty_cards WHERE card_number = ${number}`
    if (c.length === 0 || c[0].disabled_at) return fail(404, 'No active card with that number')
    if (c[0].balance < STAMPS_PER_REWARD) return fail(409, `Not enough stamps yet: ${c[0].balance} of ${STAMPS_PER_REWARD}`)
    return fail(409, 'A reward was just redeemed on this card, wait a moment before redeeming another')
  }
  return { ok: true, card: { cardNumber: rows[0].card_number, label: rows[0].label, balance: rows[0].balance } }
}

// Reverses one stamp or one redemption by adding an opposite entry. The original stays in the history, and a stamped
// order stays used, so a voided stamp cannot be turned into a second stamp for the same order.
export async function voidEntry(sql, { entryId, staff, note }) {
  const id = Number(entryId)
  if (!Number.isInteger(id) || id < 1) return fail(400, 'That is not a valid entry')
  await ensureTables(sql)
  try {
    const { rows } = await sql`
      WITH e AS (
        SELECT id, card_id, stamps FROM loyalty_ledger WHERE id = ${id}::int AND kind IN ('stamp', 'redeem')
      ), ins AS (
        INSERT INTO loyalty_ledger (card_id, kind, stamps, voids_id, staff, note)
        SELECT e.card_id, 'void', -e.stamps, e.id, ${clean(staff, 40) || null}::text, ${clean(note, 120) || null}::text FROM e
        ON CONFLICT (voids_id) WHERE kind = 'void' DO NOTHING
        RETURNING card_id, stamps
      ), upd AS (
        UPDATE loyalty_cards c
        SET balance = c.balance + ins.stamps, rewards_redeemed = c.rewards_redeemed + CASE WHEN ins.stamps > 0 THEN -1 ELSE 0 END
        FROM ins WHERE c.id = ins.card_id
        RETURNING c.card_number, c.label, c.balance
      )
      SELECT card_number, label, balance FROM upd
    `
    if (rows.length === 0) {
      const { rows: e } = await sql`SELECT kind FROM loyalty_ledger WHERE id = ${id}::int`
      if (e.length === 0 || e[0].kind === 'void') return fail(404, 'No stamp or reward with that number')
      return fail(409, 'That entry has already been undone')
    }
    return { ok: true, card: { cardNumber: rows[0].card_number, label: rows[0].label, balance: rows[0].balance } }
  } catch (err) {
    // The balance can never go below zero (a database rule), for example undoing a stamp that was already spent on a reward.
    if (err && (err.code === '23514' || /check constraint|violates/i.test(String(err.message)))) {
      return fail(409, 'That stamp has already been spent on a reward. Undo the reward first.')
    }
    throw err
  }
}

// A new secret link for a customer who lost theirs. The old link stops working at once.
export async function regenerateLink(sql, { cardNumber }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  await ensureTables(sql)
  const token = newToken()
  const { rows } = await sql`
    UPDATE loyalty_cards SET token_hash = ${hashToken(token)} WHERE card_number = ${number} AND disabled_at IS NULL
    RETURNING card_number, label
  `
  if (rows.length === 0) return fail(404, 'No active card with that number')
  return { ok: true, card: { cardNumber: rows[0].card_number, label: rows[0].label }, token }
}

export async function setCardDisabled(sql, { cardNumber, disabled }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  await ensureTables(sql)
  const { rows } = disabled
    ? await sql`UPDATE loyalty_cards SET disabled_at = COALESCE(disabled_at, now()) WHERE card_number = ${number} RETURNING card_number`
    : await sql`UPDATE loyalty_cards SET disabled_at = NULL WHERE card_number = ${number} RETURNING card_number`
  if (rows.length === 0) return fail(404, 'No card with that number')
  return { ok: true }
}
