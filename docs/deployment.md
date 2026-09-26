# Deployment

Production: **https://invana.stream** (Netlify).  
App uses **BrowserRouter** path URLs (`/invite/:slug`, `/create`, …). SPA hosts need a fallback rewrite to `index.html`.

Architecture overview: [architecture.md](architecture.md) · env vars: [README](../README.md#environment).

---

## Netlify (production)

Config: `netlify.toml` + `public/_redirects` — `/* → /index.html` (200).

```bash
npm run build
# connect the repo in Netlify, or publish dist/
```

**Build env** (also documented in `netlify.toml`):

| Variable | Example |
|----------|---------|
| `VITE_PUBLIC_SITE_URL` | `https://invana.stream` |
| `VITE_SUPABASE_URL` | `https://….supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable / anon key |
| `VITE_MESSAGING_MODE` | unset / `wa_me` / `cloud` |
| `VITE_REQUIRE_SIGN_IN` | `true` (default) |
| `VITE_GA_MEASUREMENT_ID` | optional |

After deploy, submit `https://invana.stream/sitemap.xml` in Google Search Console.

**Invite OG for bots:** Edge Function `og-invite` returns HTML with `og:*` tags. Wire a CDN/bot rewrite to that function when ready; until then, client-side meta updates after the invite loads.

---

## Vercel

Config: `vercel.json` SPA rewrites.

```bash
npm i -g vercel
vercel
```

Set the same `VITE_*` vars as Netlify.

---

## Cloudflare Pages

- Build: `npm run build`  
- Output: `dist`  
- SPA fallback: `/* /index.html 200` (or Dashboard equivalent)

---

## GitHub Pages (legacy)

Workflow: `.github/workflows/deploy-pages.yml`.  
Prefer Netlify for crawlable path URLs. The app migrates old `/#/path` links to `/path` on load.

---

## Connected Mode checklist (host + Supabase)

1. Apply SQL migrations ([supabase/README.md](../supabase/README.md)).  
2. Deploy Edge Functions: `invite`, `rsvp`, `media`, `events`, `og-invite` (+ `whatsapp-*` if using Cloud API).  
3. Set frontend `VITE_*` on the host.  
4. Set Edge secrets only in Supabase (`WHATSAPP_*`, optional `PUBLIC_SITE_URL`) — never in `VITE_*`.  
5. Verify: sign in → upload photo → Save → Publish → open `/invite/{slug}` → RSVP from another browser → host dashboard.

---

## SPA config matrix

| Host | Config | Purpose |
|------|--------|---------|
| Netlify | `netlify.toml` + `public/_redirects` | Path deep links (production) |
| Vercel | `vercel.json` | Path deep links |
| GitHub Pages | workflow `404.html` | Project-pages fallback |

Always set `VITE_PUBLIC_SITE_URL` to the canonical origin so share links, QR, OG, and magic-link redirects stay absolute.
