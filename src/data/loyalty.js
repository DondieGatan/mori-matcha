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
