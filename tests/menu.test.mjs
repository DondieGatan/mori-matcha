import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FEATURED_DRINKS, MENU_DRINKS, SUGAR_DATA, MILK_ELIGIBLE_DRINKS, SIZES, SIZE_SURCHARGE, sizeSurcharge, unitPriceFor,
} from '../src/data/menu.js'
import { CHEAPEST_DRINK_PRICE } from '../src/data/loyalty.js'
import { PARTY_VARIETIES } from '../src/data/partyCart.js'
import { ruleAnswer, buildFacts, DRINKS } from '../api/_lib/shop.js'

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
  assert.match(ruleAnswer('what sizes do you have?'), /12oz.*16oz.*₱30 more/)
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
