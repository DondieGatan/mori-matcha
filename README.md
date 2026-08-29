# Mori Matcha

A single-page marketing + ordering site for Mori Matcha, a matcha café.
React + Vite, no backend — order tracking posts to a Google Sheet via a
small Apps Script (see `apps-script-order-log.gs`).

**Live:** [mori-matcha-inky.vercel.app](https://mori-matcha-inky.vercel.app) — deployed and actually in use, not a demo.

## Structure

```
index.html               — Vite entry (head meta, JSON-LD, #root)
src/
  main.jsx                — mounts <App />, imports global styles
  App.jsx                 — page layout / top-level state
  components/              — one component per page section + the two modals
  hooks/                    — useCart, useOpenStatus, useReveal, useBump
  data/                     — menu/drink data, FAQ, order-log config
  styles/style.css          — global stylesheet (unchanged theme/design)
public/
  assets/                   — product photos, hero cutout, icons
  manifest.json, robots.txt, sitemap.xml
apps-script-order-log.gs   — paste into Extensions > Apps Script on the
                              order-tracking Google Sheet
```

## Run it

```bash
npm install
npm run dev
```

Then visit `http://localhost:8092` (port is fixed in `vite.config.js`).

## Build for deployment

```bash
npm run build
```

Outputs a static `dist/` folder — deployable to GitHub Pages or any static
host, same as before.

## Still to fill in

- `public/assets/logo.png` — the real brand logo (nav and hero currently
  fall back to text until this file exists)
- About section copy
- `REPLACE_WITH_SITE_URL` placeholders in `index.html` (OG tags, JSON-LD),
  `public/robots.txt`, and `public/sitemap.xml` — fill in once hosted

## Stack

React 19 · Vite · Google Fonts (Cormorant Garamond, Jost) · Google Apps
Script (order log)
