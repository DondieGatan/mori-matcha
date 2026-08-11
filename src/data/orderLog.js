// Order log — posts each order to the site's own /api/orders endpoint
// (Vercel serverless function + Postgres). Fire-and-forget: a failure here
// should never block the actual Instagram order from going out.
export async function submitOrder(orderNumber, items, total) {
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, items, total }),
    })
  } catch (e) {
    // swallow — background logging should never break the order flow
  }
}
