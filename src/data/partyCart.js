// Party Cart packages and terms. Prices are in pesos.
export const PARTY_PACKAGES = [
  { key: 'mini', short: 'Mini', name: 'Mini Matcha Cart', guests: 20, service: '1–2 hours of service', price: 3000, perGuest: 150 },
  { key: 'classic', short: 'Classic', name: 'Classic Matcha Cart', guests: 30, service: '2 hours of service', price: 4200, perGuest: 140 },
  { key: 'party', short: 'Party', name: 'Matcha Party', guests: 50, service: '2.5 hours of service', price: 6500, perGuest: 130 },
  { key: 'grand', short: 'Grand', name: 'Grand Matcha Bar', guests: 100, service: '3 hours of service', price: 11500, perGuest: 115 },
]

export const PARTY_INCLUDED = [
  'Physical Mori Matcha cart setup',
  'Freshly prepared matcha drinks served on-site',
  'Choose your preferred variety of matcha drinks',
  'Full Cream or Oat Milk',
  'Choice of sweetness',
  'Cups, ice, and basic serving supplies',
  'Mori Matcha staff member for the included service period',
]

export const PARTY_VARIETIES = [
  'Matcha Latte',
  'Matcha Sea Salt',
  'Strawberry Matcha',
  'Mango Matcha',
  'Ube Matcha',
  'Oreo Cloud Matcha',
]

export const PARTY_ADDONS = [
  { label: 'Extra drink', value: '₱130–₱150 each' },
  { label: 'Additional service hour', value: '₱500–₱700' },
  { label: 'Custom event styling', value: 'Quoted upon request' },
  { label: 'Custom name/event stickers', value: 'Quoted upon request' },
  { label: 'Transportation', value: 'Based on event location' },
]

export const PARTY_NOTES = [
  '50% deposit is required to reserve the date.',
  'Final guest count and drink selections should be confirmed before the event.',
  'Each package includes one drink per guest.',
  'Transportation fees may apply depending on location.',
  'Remaining balance is due before or on the event date.',
]
