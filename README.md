# Invana

Premium event invitations, RSVP sites, and bio cards — React + Vite + TypeScript.

**Demo Mode** (default): drafts, RSVPs, and shares use `localStorage` and `wa.me` when Supabase env is empty.  
**Connected Mode**: set Supabase publishable URL/key → Auth, Postgres persistence, Storage, and optional WhatsApp Cloud API via Edge Functions.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build      # typecheck + production build
npm run preview    # serve dist/
npm run lint
npm run typecheck
```

## Product flow

1. **Create** → defaults to **Invitation + Wedding** (`/create` → `/create/wedding`); switch occasion or open **Create card** anytime  
2. **Template** → choose an original composition  
3. **Builder** → short form + expandable More details, theme, live SVG preview  
4. **Export** → PNG / PDF  
5. **Publish** → public `#/invite/:slug` page (countdown + map CTA when data is present)  
6. **Share** → WhatsApp via `wa.me` (or Cloud API when configured)  
7. **RSVP** → guests respond; counts on **My events**

## Architecture (short)

| Layer | Role |
|--------|------|
| `TemplateDefinition` + `RenderInput` | Canonical data for preview, export, and invite site |
| `Composition` SVG renderer | Single render path (not a screenshot) |
| `PersistenceProvider` / `AuthProvider` / `MessagingProvider` / `StorageProvider` | Interfaces; Demo vs Supabase adapters |
| `BrowserRouter` + Netlify SPA redirects | Path deep links on https://invana.stream |

See [docs/architecture.md](docs/architecture.md), [docs/deployment.md](docs/deployment.md), [docs/whatsapp.md](docs/whatsapp.md), and [REQUIREMENTS.md](REQUIREMENTS.md).

## SEO notes

Canonical site: **https://invana.stream**. Per-route `document.title`, description, keywords, and Open Graph / Twitter tags are applied via `Seo` / `usePageMeta` (`src/seo/`). `index.html`, `public/robots.txt`, and `public/sitemap.xml` provide crawler fallbacks. Netlify SPA fallback (`netlify.toml` / `public/_redirects`) keeps `/invite/:slug` and other path routes crawlable.

Invite pages update meta client-side after the event loads (good for tabs and JS-capable clients). Link-preview bots that only read the static HTML shell still see homepage OG tags — **prerender or SSR for `/invite/*`** would improve WhatsApp/Facebook share cards later.

## Environment

Copy `.env.example`. Leave Supabase vars empty for Demo Mode:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_MESSAGING_MODE=          # demo | wa_me | cloud
VITE_PUBLIC_SITE_URL=https://invana.stream   # local: http://localhost:5173
VITE_GA_MEASUREMENT_ID=       # optional GA4 (G-XXXXXXXX)
```

Never put service-role keys, WhatsApp tokens, or other secrets in `VITE_*` vars.

## Enable Connected Mode

1. Create a Supabase project.  
2. Run SQL migrations in order (see [supabase/README.md](supabase/README.md)):
   - `supabase/migrations/20260324000000_init.sql`
   - `supabase/migrations/20260324000001_rls.sql`
   - `supabase/migrations/20260324000002_storage.sql`
3. Enable **Email** auth (magic link) in Supabase Auth.  
4. Copy Project URL + **anon/publishable** key into `.env`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_PUBLIC_SITE_URL=http://localhost:5173
```

5. Restart `npm run dev`. The app switches adapters automatically (`modeLabel()` → Connected).  
6. Sign in via magic link before saving drafts (Connected auth). Call `supabaseAuth.signInWithMagicLink(email)` from a future sign-in UI, or the Supabase Auth helpers.  
7. Optional WhatsApp Cloud: deploy Edge Functions, set secrets, then `VITE_MESSAGING_MODE=cloud` ([docs/whatsapp.md](docs/whatsapp.md)).

## Hosting

| Target | Notes |
|--------|--------|
| **Netlify (production)** | https://invana.stream — `netlify.toml` + `public/_redirects` SPA fallback |
| **Vercel** | `vercel.json` SPA rewrites — [docs/deployment.md](docs/deployment.md) |
| **GitHub Pages** | Existing workflow; hash routes (legacy) |

### GitHub Pages

1. Repo **Settings → Pages → Source: GitHub Actions**  
2. Push to `main` (or `master`) — workflow lint → typecheck → build → deploy  
3. Enable Pages; the workflow copies `index.html` to `404.html` for path fallbacks

Project pages work with relative `base: './'` and hash routes (`/#/invite/slug`).

## Scripts & stack

- React 18, Vite 5, Tailwind 3, Zod, jsPDF, qrcode, `@supabase/supabase-js`  
- Editorial UI: Playfair / Cormorant + Inter, cream / gold / ink  

## License note

Templates are original Invana compositions (see each template’s `license` metadata). Do not paste third-party Canva/Pinterest artwork.
