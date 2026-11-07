import { neon } from '@neondatabase/serverless'
import { SYSTEM_PROMPT, buildFacts, ruleAnswer } from './_lib/shop.js'

// Customer-service assistant. POST { messages: [{ role: 'user' | 'assistant', text }] } -> { reply, source }.
// With GEMINI_API_KEY set the reply is written by the model from the café's own facts; without a key, or if the model
// fails, the reply comes from the rule-based answers in _lib/shop.js, so the assistant always answers.

const MODELS = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite'].filter(Boolean)
const MAX_MESSAGE_CHARS = 500
const MAX_TURNS = 10
const MODEL_TIMEOUT_MS = 12000

// Best-effort flood guard: each warm serverless instance remembers recent callers. It cannot see other instances, so it
// limits abuse rather than guaranteeing a hard cap.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 30
const hits = new Map()

function tooMany(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k)
  return recent.length > MAX_PER_WINDOW
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'unknown'
}

async function liveAvailability() {
  if (!process.env.DATABASE_URL) return {}
  try {
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`SELECT drink_key, status FROM availability WHERE status != 'available'`
    const out = {}
    for (const r of rows) out[r.drink_key] = r.status
    return out
  } catch {
    return {}
  }
}

// Text that is read aloud should be plain: drop markdown marks, links and emoji the model slips in.
export function cleanReply(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>~|]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700)
}

async function askModel(history, facts, apiKey) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT + facts }] },
    contents: history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
  }
  for (const model of MODELS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS)
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) continue
      const data = await res.json()
      const text = cleanReply((data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(' '))
      if (text) return text
    } catch {
      // try the next model
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const raw = req.body && Array.isArray(req.body.messages) ? req.body.messages : null
  if (!raw || raw.length === 0) return res.status(400).json({ error: 'messages (a non-empty array) is required' })

  const history = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_TURNS)
  // Gemini needs the conversation to start with the customer and end with their question.
  while (history.length && history[0].role !== 'user') history.shift()
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'The last message must be from the customer' })
  }

  if (tooMany(clientIp(req))) {
    return res.status(429).json({ error: 'You are sending messages very quickly. Please wait a moment and try again.' })
  }

  const statuses = await liveAvailability()
  const question = history[history.length - 1].text

  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) {
    const reply = await askModel(history, buildFacts(statuses), apiKey)
    if (reply) return res.status(200).json({ reply, source: 'ai' })
  }
  return res.status(200).json({ reply: ruleAnswer(question, statuses), source: 'rules' })
}
