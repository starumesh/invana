# Deployment

## GitHub Pages (existing)

Workflow: `.github/workflows/deploy-pages.yml`  
Uses `HashRouter` + `base: './'`. Deep links: `/#/invite/<slug>`.

## Vercel (dedicated host)

Config: `vercel.json` — SPA rewrite so path-style routes resolve if you later switch to `BrowserRouter`.

```bash
npm i -g vercel
vercel
```

Set env in the Vercel project: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_SITE_URL`, optional `VITE_MESSAGING_MODE`.

**Deep links today:** with `HashRouter`, refresh works without rewrites (`https://your.app/#/invite/slug`).  
**If you switch to `BrowserRouter`:** keep the `vercel.json` rewrite so `/invite/:slug` serves `index.html`.

## Netlify (dedicated host)

Config: `netlify.toml` — same SPA fallback via `[[redirects]]`.

```bash
npm run build
# drag dist/ in Netlify UI, or connect the repo
```

## Cloudflare Pages

Build command: `npm run build` · Output: `dist`  
Add a `_redirects` file (or Dashboard SPA fallback) equivalent to `/* /index.html 200` if using path routing.

## SPA notes

| Host | Config file | Purpose |
|------|-------------|---------|
| GitHub Pages | workflow copies `404.html` | Path fallback for project pages |
| Vercel | `vercel.json` rewrites | Path deep links |
| Netlify | `netlify.toml` redirects | Path deep links |

Prefer setting `VITE_PUBLIC_SITE_URL` to the canonical HTTPS origin (custom domain) so share links and QR codes are absolute.
