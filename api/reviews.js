// Mori Matcha Home Cafe's Google Place ID — not secret, safe to hardcode.
const PLACE_ID = 'ChIJLz3Ww9_VlzMR9J4R_cPuKnw'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end('Method Not Allowed')
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return res.status(200).json({ reviews: [], _debug: 'no GOOGLE_PLACES_API_KEY in this environment' })
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=en`
    const upstream = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'reviews',
      },
    })

    if (!upstream.ok) {
      const errorBody = await upstream.text().catch(() => '')
      return res.status(200).json({ reviews: [], _debug: { status: upstream.status, body: errorBody } })
    }

    const data = await upstream.json()
    const reviews = (data.reviews || []).map((r) => ({
      name: r.authorAttribution?.displayName || 'Google user',
      rating: r.rating || 0,
      text: r.text?.text || '',
      time: r.publishTime || null,
    }))

    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json({ reviews, _debug: { rawReviewCount: (data.reviews || []).length, keys: Object.keys(data) } })
  } catch (e) {
    return res.status(200).json({ reviews: [], _debug: { error: String(e) } })
  }
}
