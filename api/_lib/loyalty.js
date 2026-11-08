// Loyalty card engine. The server is the only place a stamp can come from, and every change is a row in an append-only
// ledger. Each rule that stops cheating is enforced here, in the database, not in the browser:
//  - a stamp needs a real order the café has marked paid, and an order can be stamped once, ever (unique index)
//  - an order's stamps are capped by what was paid at the cheapest drink, so a fake "8 drinks for 1 peso" order earns 1
//  - a reward needs enough stamps, is taken in the same statement that checks them, and a double click cannot take two
//  - the card's secret link is random (128 bits). Customers' links are checked against a one-way hash. Staff can see a link
//    again because an encrypted copy is kept, sealed with a key made from the admin key, so the database alone never reveals one
//  - a mistake is undone with a reversing entry (a "void"), never by editing or deleting history
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomInt } from 'node:crypto'
import {
  CARD_NUMBER_ALPHABET,
  CARD_NUMBER_PATTERN,
  CARD_VALID_DAYS,
  STAMPS_PER_REWARD,
  addDays,
  formatDate,
  normalizeDate,
  stampsForOrder,
  todayInManila,
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
  await sql`ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS token_enc TEXT`
  await sql`ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS expires_on DATE`
  await sql`ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  await sql`
    CREATE TABLE IF NOT EXISTS loyalty_edits (
      id SERIAL PRIMARY KEY,
      card_id INTEGER NOT NULL REFERENCES loyalty_cards(id),
      field TEXT NOT NULL CHECK (field IN ('name', 'number', 'status', 'link', 'expiry')),
      old_value TEXT,
      new_value TEXT,
      staff TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  // A database that made this table earlier only allowed name and number changes; widen what it accepts.
  try {
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_edits_field_ok2') THEN
          ALTER TABLE loyalty_edits DROP CONSTRAINT IF EXISTS loyalty_edits_field_check;
          ALTER TABLE loyalty_edits DROP CONSTRAINT IF EXISTS loyalty_edits_field_ok;
          ALTER TABLE loyalty_edits ADD CONSTRAINT loyalty_edits_field_ok2 CHECK (field IN ('name', 'number', 'status', 'link', 'expiry'));
        END IF;
      END $$
    `
  } catch (err) {
    // two cold starts can race to add the same rule; the one that loses can ignore it
    if (!err || !['42710', '40P01', '23505'].includes(err.code)) throw err
  }
  await sql`CREATE INDEX IF NOT EXISTS loyalty_edits_card ON loyalty_edits (card_id, id DESC)`
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

// The encrypted copy of a link (AES-256-GCM). The key comes from the admin key, so someone who only has the database cannot read
// links, and changing the admin key makes the saved copies unreadable (staff then press "New link"). With no admin key set,
// nothing is saved.
function linkKey() {
  const secret = process.env.ADMIN_KEY
  if (!secret) return null
  return Buffer.from(hkdfSync('sha256', secret, 'mori-loyalty-links', 'card-link-encryption-v1', 32))
}

export function sealToken(token) {
  const key = linkKey()
  if (!key) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

export function openToken(blob) {
  const key = linkKey()
  if (!key || typeof blob !== 'string') return null
  try {
    const [version, iv, tag, data] = blob.split('.')
    if (version !== 'v1') return null
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const token = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
    return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------------------------------------------------

// The customer's own card, found by its secret token. Anything wrong with the token looks the same: not found.
export async function viewCard(sql, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return fail(404, 'Card not found')
  await ensureTables(sql)
  const { rows } = await sql`
    SELECT id, card_number, label, balance, rewards_redeemed, expires_on::text AS expires_on,
      (expires_on IS NOT NULL AND expires_on < (now() AT TIME ZONE 'Asia/Manila')::date) AS expired
    FROM loyalty_cards WHERE token_hash = ${hashToken(token)} AND disabled_at IS NULL AND deleted_at IS NULL
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
      expiresOn: c.expires_on,
      expired: Boolean(c.expired),
      history: history.map((h) => ({ kind: h.kind, stamps: h.stamps, at: h.created_at })),
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Staff side (every function below is only reachable with the admin key; see api/loyalty.js)
// ---------------------------------------------------------------------------------------------------------------------

// Reads the "valid until" a staff member typed: nothing sent means the default, an empty value means no expiry, otherwise a real date.
function readExpiry(input, { allowPast }) {
  if (input === undefined) return { ok: true, value: undefined }
  if (input === null || String(input).trim() === '') return { ok: true, value: null }
  const date = normalizeDate(input)
  if (!date) return { ok: false, error: 'That is not a valid date. Pick a date, or leave it empty for no expiry' }
  if (!allowPast && date < todayInManila()) return { ok: false, error: 'That date has already passed' }
  return { ok: true, value: date }
}

export async function createCard(sql, { label, expiresOn }) {
  const name = clean(label, 60)
  if (!name) return fail(400, 'Enter the customer name or Instagram handle')
  const exp = readExpiry(expiresOn, { allowPast: false })
  if (!exp.ok) return fail(400, exp.error)
  const expiry = exp.value === undefined ? addDays(todayInManila(), CARD_VALID_DAYS) : exp.value
  await ensureTables(sql)
  const token = newToken()
  for (let attempt = 0; attempt < 8; attempt++) {
    const cardNumber = newCardNumber()
    const { rows } = await sql`
      INSERT INTO loyalty_cards (card_number, token_hash, token_enc, label, expires_on)
      VALUES (${cardNumber}, ${hashToken(token)}, ${sealToken(token)}, ${name}, ${expiry}::date)
      ON CONFLICT (card_number) DO NOTHING
      RETURNING card_number, label, balance, expires_on::text AS expires_on
    `
    if (rows.length) return { ok: true, card: { cardNumber: rows[0].card_number, label: rows[0].label, balance: 0, expiresOn: rows[0].expires_on }, token }
  }
  return fail(500, 'Could not create a card number, please try again')
}

export async function searchCards(sql, { q, includeDeleted }) {
  await ensureTables(sql)
  const term = '%' + clean(q, 40).replace(/[\\%_]/g, '\\$&') + '%'
  const { rows } = await sql`
    SELECT card_number, label, balance, rewards_redeemed, created_at, disabled_at, deleted_at, expires_on::text AS expires_on,
      (expires_on IS NOT NULL AND expires_on < (now() AT TIME ZONE 'Asia/Manila')::date) AS expired
    FROM loyalty_cards
    WHERE (card_number ILIKE ${term} OR label ILIKE ${term}) AND (deleted_at IS NULL OR ${Boolean(includeDeleted)}::boolean)
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
      deleted: Boolean(c.deleted_at),
      expiresOn: c.expires_on,
      expired: Boolean(c.expired),
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
  const { rows: edits } = await sql`
    SELECT e.id, e.field, e.old_value, e.new_value, e.staff, e.created_at
    FROM loyalty_edits e JOIN loyalty_cards c ON c.id = e.card_id
    WHERE c.card_number = ${number} ORDER BY e.id DESC LIMIT 30
  `
  return { ok: true, entries: rows, edits }
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
      WHERE c.card_number = ${number} AND c.disabled_at IS NULL AND c.deleted_at IS NULL
        AND (c.expires_on IS NULL OR c.expires_on >= (now() AT TIME ZONE 'Asia/Manila')::date)
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
    const { rows: st } = await sql`
      SELECT disabled_at, deleted_at, expires_on::text AS expires_on,
        (expires_on IS NOT NULL AND expires_on < (now() AT TIME ZONE 'Asia/Manila')::date) AS expired
      FROM loyalty_cards WHERE card_number = ${number}
    `
    if (st.length && !st[0].disabled_at && !st[0].deleted_at && st[0].expired) {
      return fail(409, `This card expired on ${formatDate(st[0].expires_on)}. Extend it (Edit, then Valid until) before adding stamps.`)
    }
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
      WHERE c.card_number = ${number} AND c.disabled_at IS NULL AND c.deleted_at IS NULL AND c.balance >= ${STAMPS_PER_REWARD}::int
        AND (c.expires_on IS NULL OR c.expires_on >= (now() AT TIME ZONE 'Asia/Manila')::date)
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
    const { rows: c } = await sql`
      SELECT balance, disabled_at, deleted_at, expires_on::text AS expires_on,
        (expires_on IS NOT NULL AND expires_on < (now() AT TIME ZONE 'Asia/Manila')::date) AS expired
      FROM loyalty_cards WHERE card_number = ${number}
    `
    if (c.length === 0 || c[0].disabled_at || c[0].deleted_at) return fail(404, 'No active card with that number')
    if (c[0].expired) return fail(409, `This card expired on ${formatDate(c[0].expires_on)}. Extend it (Edit, then Valid until) before giving a free drink.`)
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
      return fail(409, 'That entry has already been deleted')
    }
    return { ok: true, card: { cardNumber: rows[0].card_number, label: rows[0].label, balance: rows[0].balance } }
  } catch (err) {
    // The balance can never go below zero (a database rule), for example undoing a stamp that was already spent on a reward.
    if (err && (err.code === '23514' || /check constraint|violates/i.test(String(err.message)))) {
      return fail(409, 'That stamp has already been spent on a reward. Delete the free-drink entry first.')
    }
    throw err
  }
}

// A new secret link for a customer who lost theirs. The old link stops working at once, and the change is recorded.
export async function regenerateLink(sql, { cardNumber, staff }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  await ensureTables(sql)
  const token = newToken()
  const { rows } = await sql`
    WITH upd AS (
      UPDATE loyalty_cards SET token_hash = ${hashToken(token)}, token_enc = ${sealToken(token)}
      WHERE card_number = ${number} AND disabled_at IS NULL AND deleted_at IS NULL
      RETURNING id, card_number, label
    ), log AS (
      INSERT INTO loyalty_edits (card_id, field, old_value, new_value, staff)
      SELECT id, 'link', 'old link', 'new link made', ${clean(staff, 40) || null}::text FROM upd
      RETURNING id
    )
    SELECT card_number, label FROM upd
  `
  if (rows.length === 0) return fail(404, 'No active card with that number')
  return { ok: true, card: { cardNumber: rows[0].card_number, label: rows[0].label }, token }
}

// Turn a card off (its link and number stop working, stamps and history stay) or back on. Every real change is recorded with
// who did it and when; asking for the state it is already in changes and records nothing.
export async function setCardDisabled(sql, { cardNumber, disabled, staff }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  await ensureTables(sql)
  const want = Boolean(disabled)
  const { rows } = await sql`
    WITH cur AS (
      SELECT id, disabled_at IS NOT NULL AS was FROM loyalty_cards WHERE card_number = ${number} AND deleted_at IS NULL
    ), upd AS (
      UPDATE loyalty_cards c
      SET disabled_at = CASE WHEN ${want}::boolean THEN COALESCE(c.disabled_at, now()) ELSE NULL END
      FROM cur WHERE c.id = cur.id
      RETURNING c.id
    ), log AS (
      INSERT INTO loyalty_edits (card_id, field, old_value, new_value, staff)
      SELECT cur.id, 'status', CASE WHEN cur.was THEN 'disabled' ELSE 'enabled' END, CASE WHEN ${want}::boolean THEN 'disabled' ELSE 'enabled' END, ${clean(staff, 40) || null}::text
      FROM cur WHERE cur.was <> ${want}::boolean
      RETURNING id
    )
    SELECT id FROM upd
  `
  if (rows.length === 0) return fail(404, 'No card with that number')
  return { ok: true }
}

// The customer's private link, so staff can see it and copy it again. Cards made before links were saved have no copy: the staff
// panel then offers "New link". A saved copy that no longer matches the card's hash (or cannot be opened) is reported as unreadable.
export async function cardLink(sql, { cardNumber }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  await ensureTables(sql)
  const { rows } = await sql`SELECT token_hash, token_enc, disabled_at, deleted_at FROM loyalty_cards WHERE card_number = ${number}`
  if (rows.length === 0) return fail(404, 'No card with that number')
  if (rows[0].deleted_at) return { ok: true, token: null, reason: 'deleted' }
  if (!rows[0].token_enc) return { ok: true, token: null, reason: 'not-saved' }
  const token = openToken(rows[0].token_enc)
  if (!token || hashToken(token) !== rows[0].token_hash) return { ok: true, token: null, reason: 'unreadable' }
  return { ok: true, token, disabled: Boolean(rows[0].disabled_at) }
}

// Fix a typo in the customer's name or the card number. The stamps, history and secret link stay exactly as they are; every
// change is written to the edit history (who, what, when). A card number must keep the LC-XXXX shape and be unused.
export async function editCard(sql, { cardNumber, label, newCardNumber, expiresOn, staff }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  const wantsName = label !== undefined && label !== null
  const name = wantsName ? clean(label, 60) : null
  if (wantsName && !name) return fail(400, 'Enter the customer name or Instagram handle')
  const wantsNumber = newCardNumber !== undefined && newCardNumber !== null && String(newCardNumber).trim() !== ''
  const target = wantsNumber ? normalizeCardNumber(newCardNumber) : null
  if (wantsNumber && !target) return fail(400, 'A card number looks like LC-7K3Q: LC- and 4 letters or numbers (no O, I, L, 0 or 1)')
  const wantsExpiry = expiresOn !== undefined
  const exp = readExpiry(expiresOn, { allowPast: true })
  if (!exp.ok) return fail(400, exp.error)
  if (!wantsName && !wantsNumber && !wantsExpiry) return fail(400, 'Nothing to change')
  await ensureTables(sql)

  const { rows: found } = await sql`SELECT id, card_number, label, balance, expires_on::text AS expires_on, deleted_at FROM loyalty_cards WHERE card_number = ${number}`
  if (found.length === 0) return fail(404, 'No card with that number')
  if (found[0].deleted_at) return fail(404, 'That card was deleted. Restore it first')
  const cur = found[0]
  const nextName = name ?? cur.label
  const nextNumber = target ?? cur.card_number
  const nextExpiry = wantsExpiry ? exp.value : cur.expires_on
  const nameChanged = nextName !== cur.label
  const numberChanged = nextNumber !== cur.card_number
  const expiryChanged = nextExpiry !== cur.expires_on
  const same = { cardNumber: cur.card_number, label: cur.label, balance: cur.balance, expiresOn: cur.expires_on }
  if (!nameChanged && !numberChanged && !expiryChanged) return { ok: true, changed: false, card: same }

  const who = clean(staff, 40) || null
  try {
    const { rows } = await sql`
      WITH upd AS (
        UPDATE loyalty_cards SET label = ${nextName}::text, card_number = ${nextNumber}::text, expires_on = ${nextExpiry}::date
        WHERE id = ${cur.id}::int RETURNING card_number, label, balance, expires_on::text AS expires_on
      ), ee AS (
        INSERT INTO loyalty_edits (card_id, field, old_value, new_value, staff)
        SELECT ${cur.id}::int, 'expiry', ${cur.expires_on ?? 'no expiry'}::text, ${nextExpiry ?? 'no expiry'}::text, ${who}::text WHERE ${expiryChanged}::boolean
        RETURNING id
      ), en AS (
        INSERT INTO loyalty_edits (card_id, field, old_value, new_value, staff)
        SELECT ${cur.id}::int, 'name', ${cur.label}::text, ${nextName}::text, ${who}::text WHERE ${nameChanged}::boolean
        RETURNING id
      ), eu AS (
        INSERT INTO loyalty_edits (card_id, field, old_value, new_value, staff)
        SELECT ${cur.id}::int, 'number', ${cur.card_number}::text, ${nextNumber}::text, ${who}::text WHERE ${numberChanged}::boolean
        RETURNING id
      )
      SELECT card_number, label, balance, expires_on FROM upd
    `
    return { ok: true, changed: true, card: { cardNumber: rows[0].card_number, label: rows[0].label, balance: rows[0].balance, expiresOn: rows[0].expires_on } }
  } catch (err) {
    if (err && (err.code === '23505' || /unique|duplicate/i.test(String(err.message)))) return fail(409, 'Another card already has that number')
    throw err
  }
}

// Delete a card (or bring it back). Deleting hides it from the list and turns its link and number off, but nothing is erased: the
// stamps and history stay, and its stamped orders stay used, so "one stamp per order, ever" still holds. It can be restored.
export async function setCardDeleted(sql, { cardNumber, deleted, staff }) {
  const number = normalizeCardNumber(cardNumber)
  if (!number) return fail(400, 'That is not a valid card number')
  await ensureTables(sql)
  const want = Boolean(deleted)
  const { rows } = await sql`
    WITH cur AS (
      SELECT id, deleted_at IS NOT NULL AS was FROM loyalty_cards WHERE card_number = ${number}
    ), upd AS (
      UPDATE loyalty_cards c
      SET deleted_at = CASE WHEN ${want}::boolean THEN COALESCE(c.deleted_at, now()) ELSE NULL END
      FROM cur WHERE c.id = cur.id
      RETURNING c.id
    ), log AS (
      INSERT INTO loyalty_edits (card_id, field, old_value, new_value, staff)
      SELECT cur.id, 'status', CASE WHEN cur.was THEN 'deleted' ELSE 'active' END, CASE WHEN ${want}::boolean THEN 'deleted' ELSE 'restored' END, ${clean(staff, 40) || null}::text
      FROM cur WHERE cur.was <> ${want}::boolean
      RETURNING id
    )
    SELECT id FROM upd
  `
  if (rows.length === 0) return fail(404, 'No card with that number')
  return { ok: true }
}
