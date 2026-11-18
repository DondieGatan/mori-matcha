import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FEATURED_DRINKS, MENU_DRINKS, SUGAR_DATA, MILK_ELIGIBLE_DRINKS, SIZES, SIZE_SURCHARGE, sizeSurcharge, unitPriceFor,
} from '../src/data/menu.js'
import { CHEAPEST_DRINK_PRICE } from '../src/data/loyalty.js'
import { PARTY_VARIETIES } from '../src/data/partyCart.js'
import { ruleAnswer, buildFacts, DRINKS, SYSTEM_PROMPT } from '../api/_lib/shop.js'

const ALL = [...FEATURED_DRINKS, ...MENU_DRINKS]
const byKey = (k) => ALL.find((d) => d.key === k)

test('every drink is offered in 12oz (the listed price) and 16oz (+30)', () => {
  assert.deepEqual(SIZES.map((s) => [s.key, s.surcharge]), [['12oz', 0], ['16oz', 30]])
  for (const d of ALL) {
    assert.equal(unitPriceFor(d.price, '12oz', 'Regular Milk'), d.price, d.name)
    assert.equal(unitPriceFor(d.price, '16oz', 'Regular Milk'), d.price + 30, d.name)
  }
})

test('the 16oz prices match the price list', () => {
  const expected = {
    'classic-matcha-latte': [160, 190], 'matcha-sea-salt': [170, 200], 'ube-matcha-latte': [190, 220],
    'mango-matcha-bliss': [190, 220], 'strawberry-matcha-latte': [190, 220], 'oreo-cloud-matcha': [200, 230],
    'blueberry-matcha': [190, 220],
  }
  for (const [key, [p12, p16]] of Object.entries(expected)) {
    assert.equal(unitPriceFor(byKey(key).price, '12oz'), p12, key + ' 12oz')
    assert.equal(unitPriceFor(byKey(key).price, '16oz'), p16, key + ' 16oz')
  }
})

test('oat milk (+20) stacks with the size, and an unknown size costs nothing extra', () => {
  assert.equal(unitPriceFor(160, '16oz', 'Oat Milk'), 210)
  assert.equal(unitPriceFor(160, '12oz', 'Oat Milk'), 180)
  assert.equal(sizeSurcharge('32oz'), 0)
  assert.equal(sizeSurcharge(undefined), 0)
})

test('Blueberry Matcha is on the menu with sugar levels, oat milk and a new badge', () => {
  const b = byKey('blueberry-matcha')
  assert.equal(b.name, 'Blueberry Matcha')
  assert.equal(b.price, 190)
  assert.equal(b.badge, 'New')
  assert.ok(SUGAR_DATA['blueberry-matcha'])
  assert.ok(MILK_ELIGIBLE_DRINKS.includes('blueberry-matcha'))
})

test('no drink key is duplicated and every drink has sugar data', () => {
  const keys = ALL.map((d) => d.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const k of keys) assert.ok(SUGAR_DATA[k], k)
})

test('the loyalty stamp cap still uses the cheapest 12oz price', () => {
  assert.equal(CHEAPEST_DRINK_PRICE, 160)
})

test('the assistant knows both sizes, both prices and Blueberry Matcha', () => {
  const facts = buildFacts({})
  assert.match(facts, /Blueberry Matcha: ₱190 for 12oz or ₱220 for 16oz/)
  assert.match(facts, /Classic Matcha Latte: ₱160 for 12oz or ₱190 for 16oz/)
  assert.match(facts, /SIZES: Every drink comes in two sizes/)
  assert.ok(DRINKS.some((d) => d.key === 'blueberry-matcha'))
  assert.match(ruleAnswer('how much is the blueberry'), /Blueberry Matcha is ₱190 for 12oz or ₱220 for 16oz/)
  assert.match(ruleAnswer('what sizes do you have?'), /12oz and 16oz.*Blueberry Matcha ₱190 \(12oz\) or ₱220 \(16oz\)/)
  assert.match(ruleAnswer('how much is a 16oz ube'), /Ube Matcha Latte is ₱190 for 12oz or ₱220 for 16oz/)
  assert.match(ruleAnswer('what is on the menu'), /Blueberry Matcha ₱190 \(12oz\) or ₱220 \(16oz\)/)
})

test('SIZE_SURCHARGE is the single source of the 30', () => {
  assert.equal(SIZE_SURCHARGE, 30)
})

test('Blueberry Matcha is also a Party Cart variety, and the assistant lists it', () => {
  assert.ok(PARTY_VARIETIES.includes('Blueberry Matcha'))
  assert.match(buildFacts({}), /Drink varieties available for events: .*Blueberry Matcha/)
})

test('the assistant never describes the 16oz as an extra 30 pesos', () => {
  const texts = [
    buildFacts({}),
    ruleAnswer('what sizes do you have?'),
    ruleAnswer('is 16oz more expensive?'),
    ruleAnswer('how much is a 16oz ube'),
    ruleAnswer('what is on the menu'),
    ruleAnswer('tell me about the cafe'),
  ]
  for (const t of texts) {
    assert.doesNotMatch(t, /₱30 more|\+ ?₱?30|plus (₱|30)|adds ₱30|surcharge of/i)
  }
  assert.match(SYSTEM_PROMPT, /Never describe the 16oz as a surcharge/)
})

// The assistant reads the same data files as the site, so a new drink, price, size, hour or party variety reaches it
// automatically. These guards fail if something on the site would be missing from what the assistant knows.
test('the assistant facts cover every drink, both prices, every party variety and every opening-hours row', async () => {
  const { HOURS_TABLE } = await import('../src/data/menu.js')
  const facts = buildFacts({})
  for (const d of ALL) {
    assert.ok(facts.includes(`${d.name}: ₱${d.price} for 12oz or ₱${d.price + 30} for 16oz`), d.name + ' prices')
  }
  for (const v of PARTY_VARIETIES) assert.ok(facts.includes(v), 'party variety ' + v)
  for (const h of HOURS_TABLE) assert.ok(facts.includes(`${h.day}: ${h.text}`), h.day)
  assert.ok(facts.includes('Oat milk adds ₱20'))
})

test('the keyword fallback finds every drink by its name, so a new drink needs an alias or this fails', () => {
  for (const d of ALL) {
    const a = ruleAnswer(`how much is the ${d.name}`)
    assert.ok(a.includes(d.name) && a.includes(`₱${d.price} for 12oz`), `${d.name}: ${a.slice(0, 90)}`)
  }
})

test('availability set by staff reaches the assistant for the new drink too', () => {
  assert.match(buildFacts({ 'blueberry-matcha': 'unavailable' }), /Blueberry Matcha: currently unavailable/)
  assert.match(ruleAnswer('is the blueberry available?', { 'blueberry-matcha': 'coming_soon' }), /coming soon/i)
})
