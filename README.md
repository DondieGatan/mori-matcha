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
- **SEO and PWA**: meta tags, JSON-LD kept in sync with the live opening hours, per-page share previews, an
  installable web app manifest, a sitemap, and Vercel Analytics for production monitoring.

## Architecture

```
Browser (React 19 + Vite, two HTML entries: index.html and party-cart.html)
   │
   ├── /api/orders          POST: create an order (rate limited)   GET: list orders (admin key)
   ├── /api/orders/:number  PATCH status/payment or restore, DELETE to trash or purge (admin key)
   ├── /api/availability    GET per-drink status (public)   PATCH (admin key)
   └── /api/reviews         Google Places reviews (server-side key)
          │
          └── Vercel serverless functions (Node) ── Neon Postgres (orders, availability)
```

The functions create their tables on first use with idempotent migrations (`CREATE TABLE IF NOT EXISTS` and
`ADD COLUMN IF NOT EXISTS`), and skip the check once it has succeeded on a warm instance.

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
