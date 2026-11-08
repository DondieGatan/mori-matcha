// Loyalty card rules. Shared by the website, the staff dashboard and the API, so every part agrees on them.
import { FEATURED_DRINKS, MENU_DRINKS } from './menu.js'

// The card has this many slots and the last one is the free drink, so STAMPS_PER_REWARD paid drinks earn it.
// To change the card (for example 10 stamps and then a free drink), change CARD_SLOTS only.
export const CARD_SLOTS = 10
export const STAMPS_PER_REWARD = CARD_SLOTS - 1
export const REWARD_TEXT = 'a free drink of your choice'

// One stamp per drink in an order the café has marked as paid. These two limits tie a stamp to real money:
// an order can never give more stamps than its total pays for at the cheapest drink, and never more than one card's worth.
export const MAX_STAMPS_PER_ORDER = STAMPS_PER_REWARD
export const CHEAPEST_DRINK_PRICE = Math.min(...[...FEATURED_DRINKS, ...MENU_DRINKS].map((d) => d.price))

// Card numbers look like LC-7K3Q. The alphabet leaves out look-alike characters (0/O, 1/I/L) so they are easy to read out.
export const CARD_NUMBER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CARD_NUMBER_PATTERN = /^LC-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/

// How many stamps an order earns: one per drink, limited by what was actually paid, and by one card's worth.
export function stampsForOrder(items, total) {
  const drinks = Array.isArray(items)
    ? items.reduce((n, it) => n + (Number.isInteger(it?.qty) && it.qty > 0 ? Math.min(it.qty, 99) : 1), 0)
    : 1
  const paidFor = Number.isFinite(total) ? Math.floor(total / CHEAPEST_DRINK_PRICE) : 0
  return Math.max(0, Math.min(drinks, paidFor, MAX_STAMPS_PER_ORDER))
}

// A card is valid for this many days from the day it is made. Staff can change or remove the date on any card, and cards made
// before this rule existed have no expiry. After its date a card still opens and shows its stamps, but cannot earn stamps or a
// free drink until staff extend it.
export const CARD_VALID_DAYS = 365
// A card counts as "expiring soon" this many days before its last valid day (and on that day).
export const EXPIRY_WARNING_DAYS = 14

// Dates are plain calendar dates (YYYY-MM-DD) in the café's time zone, so "valid until 8 Nov" means the whole of 8 Nov in Manila.
export const CAFE_TIME_ZONE = 'Asia/Manila'

export function todayInManila(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CAFE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// Returns the date as YYYY-MM-DD if it is a real calendar date between 2020 and 2100, otherwise null.
export function normalizeDate(input) {
  const s = String(input ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  if (y < 2020 || y > 2100) return null
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : null
}

// 0 -> "today", 1 -> "tomorrow", 5 -> "in 5 days"
export function describeDaysLeft(days) {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

// 2027-11-08 -> "Nov 8, 2027"
export function formatDate(iso) {
  const n = normalizeDate(iso)
  if (!n) return ''
  const [y, m, d] = n.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-PH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
}
