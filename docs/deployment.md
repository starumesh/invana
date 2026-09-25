# Deployment

## Netlify (production — https://invana.stream)

Config: `netlify.toml` and `public/_redirects` — SPA fallback `/* → /index.html` (200) for BrowserRouter deep links.

```bash
npm run build
# connect the repo in Netlify, or drag dist/
```

Set env in the Netlify project (also defaulted in `netlify.toml`):

- `VITE_PUBLIC_SITE_URL=https://invana.stream`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- optional `VITE_MESSAGING_MODE`, `VITE_GA_MEASUREMENT_ID`

After deploy, submit `https://invana.stream/sitemap.xml` in Google Search Console for the `invana.stream` property.

## Vercel (dedicated host)

Config: `vercel.json` — SPA rewrite for path-style routes.

```bash
npm i -g vercel
vercel
```

Set env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_SITE_URL`, optional `VITE_MESSAGING_MODE`.

## GitHub Pages (legacy)

Workflow: `.github/workflows/deploy-pages.yml`  
Historically used hash routes (`/#/invite/<slug>`). Prefer Netlify + BrowserRouter for crawlable path URLs.

## Cloudflare Pages

Build command: `npm run build` · Output: `dist`  
Add a `_redirects` file (or Dashboard SPA fallback) equivalent to `/* /index.html 200` if using path routing.

## SPA notes

| Host | Config file | Purpose |
|------|-------------|---------|
| Netlify | `netlify.toml` + `public/_redirects` | Path deep links (production) |
| Vercel | `vercel.json` rewrites | Path deep links |
| GitHub Pages | workflow copies `404.html` | Path fallback for project pages |

Prefer setting `VITE_PUBLIC_SITE_URL` to `https://invana.stream` so share links, QR codes, OG, and canonical URLs stay absolute and consistent.
