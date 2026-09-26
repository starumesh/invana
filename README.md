# Invana

Premium event invitations, RSVP sites, and bio cards — React + Vite + TypeScript.

| Mode | Behavior |
|------|----------|
| **Demo** (default) | `localStorage` drafts/RSVPs, data-URL photos, `wa.me` shares — no Supabase env needed |
| **Connected** | Supabase Auth, Postgres, Storage, Edge logical APIs; optional WhatsApp Cloud API |

Production site: **https://invana.stream**

---

## Quick start

```bash
npm install
npm run dev
```

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

Copy [`.env.example`](.env.example). Leave Supabase vars empty for Demo Mode.

---

## Product flow

1. **Create** — invitation (default Wedding) or card  
2. **Template** — pick a composition  
3. **Builder** — fields, theme, live SVG preview  
4. **Download** — PNG / PDF (Connected: durable HTTPS photos after sign-in)  
5. **Publish** — public `/invite/:slug` RSVP site  
6. **Share** — WhatsApp (`wa.me` or Cloud API)  
7. **RSVP** — guests respond; host sees them on **My events**

---

## Architecture (summary)

Invana is a **host → invite → guest** product. The SPA never holds privileged secrets.

```
RenderInput (fields + templateId + theme)
        │
        ├─ Composition (SVG) → preview, PNG, PDF
        └─ InvitePage → public RSVP site
```

Connected Mode uses Supabase Auth + Postgres (RLS) + Storage, with **Phase 1 logical services** as Edge Functions (`invite`, `rsvp`, `media`, `events`, `og-invite`, WhatsApp). FE keeps adapter contracts: `PersistenceProvider` / `StorageProvider` / `AuthProvider` / `MessagingProvider`.

**Invariants**

- Publish/export image fields are durable HTTPS Storage URLs (never `blob:` / `data:` in Connected Mode).  
- Connected RSVP writes to the cloud SoR — no silent local-only fallback.  
- Demo Mode stays fully local.

Full design (actors, APIs, ownership, phases, defaults): **[docs/architecture.md](docs/architecture.md)**.

---

## Documentation

| Doc | Contents |
|-----|----------|
| **[docs/architecture.md](docs/architecture.md)** | Backend/FE architecture — source of truth |
| **[docs/deployment.md](docs/deployment.md)** | Netlify / Vercel / Pages / Cloudflare |
| **[docs/whatsapp.md](docs/whatsapp.md)** | WhatsApp Cloud API Edge setup |
| **[supabase/README.md](supabase/README.md)** | Migrations, RLS, Storage, Edge deploy |
| **[REQUIREMENTS.md](REQUIREMENTS.md)** | Product requirements |

---

## Environment

Frontend-only keys (never put service-role or WhatsApp tokens in `VITE_*`):

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_MESSAGING_MODE=            # unset | wa_me | cloud | demo
VITE_PUBLIC_SITE_URL=https://invana.stream
VITE_REQUIRE_SIGN_IN=true       # Download gate in Connected Mode
VITE_GA_MEASUREMENT_ID=         # optional GA4
```

---

## Enable Connected Mode

1. Create a Supabase project.  
2. Apply migrations in order — see [supabase/README.md](supabase/README.md).  
3. Deploy Edge Functions: `invite`, `rsvp`, `media`, `events`, `og-invite` (+ WhatsApp if needed).  
4. Enable Email (magic link) auth.  
5. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (+ `VITE_PUBLIC_SITE_URL`).  
6. Restart `npm run dev` → adapters switch to Connected.  
7. Sign in before cloud Save / Publish / Share.  
8. Optional: `VITE_MESSAGING_MODE=cloud` after [WhatsApp setup](docs/whatsapp.md).

Until Edge Functions are deployed, the SPA falls back to PostgREST / direct Storage for invite, RSVP, and uploads.

---

## Hosting

| Target | Notes |
|--------|--------|
| **Netlify** (production) | https://invana.stream — SPA fallback in `netlify.toml` |
| **Vercel** | `vercel.json` rewrites — [docs/deployment.md](docs/deployment.md) |
| **GitHub Pages** | Legacy; hash links migrate to path URLs |

App uses **BrowserRouter** (`/invite/:slug`). Old `/#/invite/...` links are redirected.

---

## Stack

React 18 · Vite 5 · TypeScript · Tailwind 3 · Zod · jsPDF · qrcode · Supabase JS · Vitest

Templates are original Invana compositions (see each template’s `license` metadata).
