export const SUGAR_DATA = {
  'classic-matcha-latte': { unit: 'Vanilla Syrup', levels: { '25%': 5, '50%': 8, Regular: 12, Sweet: 20 } },
  'mango-matcha-bliss': { unit: 'Vanilla Syrup', levels: { '25%': 5, '50%': 8, Regular: 12, Sweet: 20 } },
  'ube-matcha-latte': { unit: 'Condensed Milk', levels: { '25%': 5, '50%': 10, Regular: 15, Sweet: 25 } },
  'strawberry-matcha-latte': { unit: 'Vanilla Syrup', levels: { '25%': 5, '50%': 8, Regular: 12, Sweet: 20 } },
  'chocolate-cookies': { unit: 'Condensed Milk', levels: { '25%': 10, '50%': 15, Regular: 20, Sweet: 25 } },
  'matcha-sea-salt': { unit: 'Vanilla Syrup', levels: { '25%': 5, '50%': 8, Regular: 12, Sweet: 20 } },
}

export const LEVEL_ORDER = ['25%', '50%', 'Regular', 'Sweet']

export const MILK_SURCHARGE = 20
export const MILK_OPTIONS = ['Regular Milk', 'Oat Milk', 'Coconut Milk']
export const MILK_ELIGIBLE_DRINKS = [
  'classic-matcha-latte',
  'ube-matcha-latte',
  'strawberry-matcha-latte',
  'matcha-sea-salt',
  'mango-matcha-bliss',
]

export const FEATURED_DRINK = {
  key: 'classic-matcha-latte',
  name: 'Classic Matcha Latte',
  description: 'Our house standard — stone-ground matcha whisked with steamed milk.',
  img: '/assets/classic-matcha-latte.jpg',
  imgAlt: 'Classic Matcha Latte, matcha powder sifting over a glass',
  price: 160,
  badge: 'Best Seller',
}

export const MENU_DRINKS = [
  {
    key: 'ube-matcha-latte',
    name: 'Ube Matcha Latte',
    img: '/assets/ube-matcha-coconut.jpg',
    imgAlt: 'Ube Matcha Latte, purple and green layered drink',
    price: 170,
  },
  {
    key: 'chocolate-cookies',
    name: 'Chocolate Cookies',
    img: '/assets/chocolate-cookies.jpg',
    imgAlt: 'Chocolate Cookies drink topped with cookie crumbs',
    price: 170,
  },
  {
    key: 'strawberry-matcha-latte',
    name: 'Strawberry Matcha Latte',
    img: '/assets/matcha-strawberry.jpg',
    imgAlt: 'Strawberry Matcha Latte, matcha over a strawberry layer with a fresh strawberry on top',
    price: 190,
  },
  {
    key: 'matcha-sea-salt',
    name: 'Matcha Sea Salt',
    img: '/assets/matcha-sea-salt.jpg',
    imgAlt: 'Matcha Sea Salt, layered matcha and cream drink',
    price: 170,
  },
  {
    key: 'mango-matcha-bliss',
    name: 'Mango Matcha Bliss',
    img: '/assets/mango-matcha-bliss.jpg',
    imgAlt: 'Mango Matcha Bliss, matcha and mango layered drink topped with mango chunks',
    price: 180,
  },
]

// Add real reviews here as customers send them (e.g. via Instagram DM).
// Each entry: { name, rating (1-5), text, drink (optional) }
export const REVIEWS = [
  {
    name: 'Mary Jade De Leon',
    rating: 5,
    text: 'Really enjoyed the matcha here! Creamy, refreshing, and definitely worth trying!',
  },
  {
    name: 'Godwin',
    rating: 5,
    text: 'Absolutely loved my experience at Mori Matcha Home Cafe! The matcha was smooth, rich, and had a really nice authentic flavor without being overly bitter. You can really tell that care goes into every cup. Definitely a great grab for matcha lovers, and I’ll be coming back again! Highly recommended.',
  },
  {
    name: 'Danielle Gatan',
    rating: 5,
    text: 'Tried Mori Matcha and really enjoyed it! The matcha was smooth, creamy, refreshing and had a nice earthy flavor without being too bitter or sweet. Such a refreshing drink and definitely one I’d get again!',
  },
]

export const OPEN_HOURS = {
  0: [[9 * 60, 22 * 60 + 30]], // Sunday 9:00 AM – 10:30 PM
  1: [[18 * 60 + 30, 22 * 60 + 30]], // Monday 6:30 PM – 10:30 PM
  2: [], // Tuesday Closed
  3: [[13 * 60 + 30, 22 * 60 + 30]], // Wednesday 1:30 PM – 10:30 PM
  4: [[8 * 60, 11 * 60 + 30], [16 * 60, 22 * 60 + 30]], // Thursday 8:00 AM – 11:30 AM, 4:00 PM – 10:30 PM
  5: [[17 * 60 + 30, 22 * 60 + 30]], // Friday 5:30 PM – 10:30 PM
  6: [[9 * 60, 22 * 60 + 30]], // Saturday 9:00 AM – 10:30 PM
}

export const HOURS_TABLE = [
  { day: 'Monday', text: '6:30 PM – 10:30 PM' },
  { day: 'Tuesday', text: 'Closed' },
  { day: 'Wednesday', text: '1:30 PM – 10:30 PM' },
  { day: 'Thursday', text: '8:00 AM – 11:30 AM, 4:00 PM – 10:30 PM' },
  { day: 'Friday', text: '5:30 PM – 10:30 PM' },
  { day: 'Saturday', text: '9:00 AM – 10:30 PM' },
  { day: 'Sunday', text: '9:00 AM – 10:30 PM' },
]

export const INSTAGRAM_DM_URL = 'https://ig.me/m/mori_matchaofficial'
export const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/mori_matchaofficial/'
export const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61591820885889'
export const TIKTOK_URL = 'https://www.tiktok.com/@morimatchaofficial?is_from_webapp=1&sender_device=pc'
export const MAP_LINK_URL = 'https://www.google.com/maps/place/Golden+City+Subdivision/@14.3610438,120.9320483,858m/data=!3m2!1e3!4b1!4m6!3m5!1s0x3397d48501c7bca5:0x7793fb7f06b073ff!8m2!3d14.3610438!4d120.9320483!16s%2Fg%2F1tlzxq3j'
export const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJLz3Ww9_VlzMR9J4R_cPuKnw'
export const MAP_EMBED_URL = 'https://maps.google.com/maps?q=14.3610438,120.9320483&z=16&output=embed'

export function formatPeso(n) {
  return '₱' + n.toLocaleString('en-PH')
}

export function milkSurcharge(milk) {
  return milk && milk !== 'Regular Milk' ? MILK_SURCHARGE : 0
}
