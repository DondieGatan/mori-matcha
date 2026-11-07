# Mori Matcha

A production website for a real matcha café: a cart-based ordering flow, an admin dashboard for incoming
orders and per-drink availability, live Google Reviews, an event **Party Cart** page with a booking-inquiry
builder, and full SEO/PWA setup. React + Vite on the front, Vercel serverless functions and a Postgres (Neon)
database behind it.

[![Mori Matcha](https://dondiegatan.github.io/dondiegatan-portfolio/assets/covers/mori-matcha.webp)](https://dondiegatan.github.io/dondiegatan-portfolio/projects.html#mori-matcha)

**Live:** [mori-matcha-inky.vercel.app](https://mori-matcha-inky.vercel.app) — deployed and actually in use, not a demo.
[Demo video on my portfolio](https://dondiegatan.github.io/dondiegatan-portfolio/projects.html#mori-matcha) · built by
[Dondie Godwin Gatan](https://dondiegatan.github.io/dondiegatan-portfolio/)

**Try it in a minute (no account needed):** open the menu, tap a drink, pick a sugar level and milk, add it to the
cart, and open the cart. Then visit [/party-cart](https://mori-matcha-inky.vercel.app/party-cart) and build an
event inquiry. Nothing is sent unless you press the Instagram button, so it is safe to click around.

## Features

- **Cart-based ordering** with a built-in "How ordering works" guide. Orders are written to a Postgres order log
  through a serverless function, with rate limiting on submission and an order number the customer pastes into
  Instagram to confirm.
- **Admin dashboard** at `/admin` (protected by an admin key): order status management, CSV export, and a
  recoverable **trash bin** (deleted orders are soft-deleted with a `deleted_at` stamp, so they can be restored).
- **Tri-state per-drink availability** (available / unavailable / coming soon) managed from the admin panel and
  polled by the menu, plus "New" badges for recently added drinks.
- **Live Google Reviews** through the Places API, merged with a curated fallback list and capped so the section
  stays a tidy row of highlights.
- **Party Cart page** for events: four packages, optional add-ons and booking notes, and an inquiry builder that
  validates the details (date, guest count, venue) and composes a ready-to-send Instagram message that can be
  copied or sent in one tap.
- **"Ask Mori" customer-service assistant** on every page: a chat panel that answers questions about the menu, prices,
  sweetness and milk options, opening hours (open or closed right now, in Manila time), how to order, payment,
  delivery and the Party Cart. Replies can be **read aloud** (text-to-speech through the browser's built-in voices,
  with a per-reply Listen button and a voice-replies switch that is off by default). It never takes orders itself; it
  points customers to the cart and the Instagram step. See "The assistant" below.
- **SEO and PWA**: meta tags, JSON-LD kept in sync with the live opening hours, per-page share previews, an
  installable web app manifest, a sitemap, and Vercel Analytics for production monitoring.

## Architecture

```
Browser (React 19 + Vite, two HTML entries: index.html and party-cart.html)
   │
   ├── /api/orders          POST: create an order (rate limited)   GET: list orders (admin key)
   ├── /api/orders/:number  PATCH status/payment or restore, DELETE to trash or purge (admin key)
   ├── /api/availability    GET per-drink status (public)   PATCH (admin key)
   ├── /api/reviews         Google Places reviews (server-side key)
   └── /api/assistant       POST: customer-service chat (Gemini, with a rule-based fallback)
          │
          └── Vercel serverless functions (Node) ── Neon Postgres (orders, availability)
```

The functions create their tables on first use with idempotent migrations (`CREATE TABLE IF NOT EXISTS` and
`ADD COLUMN IF NOT EXISTS`), and skip the check once it has succeeded on a warm instance.

## The assistant

`api/assistant.js` takes the last few chat turns and returns one short, spoken-style reply.

- **Grounded in the site's own data.** `api/_lib/shop.js` builds the model's facts from `src/data` (drinks, prices,
  sweetness levels, hours, Party Cart packages), plus the live availability table, so it cannot drift from the page.
  The model is told to use only those facts, to say it is unsure about anything else (allergens, delivery fees,
  stock) and point to Instagram, and to treat customer text as a question, never as instructions.
- **Always answers.** With `GEMINI_API_KEY` set (optional `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`) the reply is
  written by Gemini, with a second model as fallback. With no key, or if both models fail, keyword-based answers
  from the same data are used, so the assistant never shows an empty state.
- **Safe to expose.** Messages are capped at 500 characters and the history at 10 turns, only `user` and `assistant`
  roles are accepted, replies are stripped of markdown, links and emoji, and each client is limited to 30 messages
  per 10 minutes per warm serverless instance (best effort, since instances do not share memory).
- **Text-to-speech** lives in `src/hooks/useSpeech.js`: the browser's `speechSynthesis`, no key and no audio leaves
  the device. It prefers a natural English voice, speaks long replies sentence by sentence, stops when the chat is
  closed or a new question is sent, and remembers the voice-replies choice.

## Structure

```
index.html, party-cart.html   Vite entries (head meta, JSON-LD, #root)
api/                          Vercel serverless functions (orders, availability, reviews, shared auth)
src/
  main.jsx                    routes: /, /admin, /party-cart
  App.jsx                     home page layout and top-level state
  pages/                      AdminPage, PartyCartPage
  components/                 one component per page section, plus the cart and sugar-level modals
  hooks/                      useCart, useOpenStatus, useReveal, useBump
  data/                       menu and drink data, party packages, FAQ, order-log config
  styles/style.css            global stylesheet
public/                       product photos, share images, manifest, robots.txt, sitemap.xml
vercel.json                   rewrites for /admin and /party-cart
apps-script-order-log.gs      legacy Google Sheets order log (replaced by the Postgres log)
```

## Run it

```bash
npm install
npm run dev
```

Then visit `http://localhost:8092` (the port is fixed in `vite.config.js`). The front end runs on its own; the
`/api` routes need the environment variables below and run on Vercel (or with `vercel dev`).

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | orders, availability | Neon Postgres connection string |
| `ADMIN_KEY` | orders, availability | key the admin dashboard sends as `x-admin-key` |
| `GOOGLE_PLACES_API_KEY` | reviews | Places API key for the live reviews section |

## Build and deploy

```bash
npm run build
```

Outputs a static `dist/`. The live site deploys to Vercel from this repository, with the functions in `api/`
deployed alongside it.

## Stack

React 19 · Vite · Vercel (static hosting and serverless functions) · Neon Postgres (`@neondatabase/serverless`) ·
Google Places API · Vercel Analytics · Google Fonts (Cormorant Garamond, Jost)
