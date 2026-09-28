# Invana

Invana is a mobile-first platform for creating premium digital invitations and
bio cards, exporting print-ready PNG/PDF files, publishing RSVP websites, and
sharing invitations through WhatsApp.

The current catalog contains **101 original templates**, **15 invitation event
types**, **10 bio/card types**, and **6 client-side theme presets**.
The npm package is currently named `event-invite-platform`; **Invana** is the
user-facing product name.

| Mode | Behavior |
|------|----------|
| **Demo** | Browser-local drafts/RSVPs, compressed data-URL photos, and `wa.me` shares; no backend required |
| **Connected** | Supabase email/password Auth, Postgres + RLS, Storage, Edge APIs, and optional WhatsApp Cloud API |

Production site: **https://invana.stream**

---

## What is implemented

- Invitation and bio-card creation across 15 event types and 10 card types.
- Original, data-driven SVG templates with theme customization and live preview.
- Photo slots with center cover-crop in builder, public invite, PNG, and PDF.
- Client-side photo compression, a 2 MB stored-object limit, and long-lived CDN caching.
- Automatic Storage cleanup when photos are replaced/removed or an event is deleted.
- PNG and PDF export with Storage photos embedded for reliable downloads.
- Public invitation URLs, QR codes, RSVP submission, and host RSVP dashboards.
- Demo Mode for zero-config use and Connected Mode for durable multi-device data.
- Guest draft/media promotion after sign-in.
- Email/password sign-in and account creation through Supabase Auth.
- WhatsApp `wa.me` sharing and optional WhatsApp Cloud API functions.
- Edge APIs for invite reads, RSVP writes, media, optional WhatsApp, event
  publish/unpublish, and OG metadata (see the integration-status table below).
- Row Level Security, owner-scoped Storage writes, request IDs, and rate limiting.

---

## Prerequisites

- Node.js 20+ and npm
- A Supabase project only for Connected Mode
- Supabase CLI only when applying migrations/deploying functions from a terminal

## Run locally

```bash
git clone <repository-url>
cd invana
npm install
npm run dev
```

Open **http://localhost:5173/** (or the URL printed by Vite). For a fixed host:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Create local configuration with `cp .env.example .env`. Leave the two Supabase
variables empty for Demo Mode. Never put service-role or WhatsApp secrets in
`VITE_*`; Vite exposes those variables to the browser.

Invana enters Connected Mode only when both `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` are real, non-placeholder values.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build production assets |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Validate TypeScript |
| `npm run lint` | Run ESLint with zero warnings |
| `npm test` | Run Vitest tests |

There are currently **22 Vitest tests across 5 files**. The GitHub Pages
workflow runs lint, type-check, and build on `main`/`master`; it does not run on
`develop`.

---

## Product flow

1. **Create** — invitation (default Wedding) or card  
2. **Template** — pick a composition  
3. **Builder** — fields, theme, live SVG preview  
4. **Download** — PNG / PDF (Connected: durable HTTPS photos after sign-in)  
5. **Publish** — public `/invite/:slug` RSVP site  
6. **Share** — WhatsApp (`wa.me` or Cloud API)  
7. **RSVP** — guests respond; host sees them on **My events**

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing home |
| `/templates` | Browse the full template catalog |
| `/create`, `/create/:eventType`, `/create/card` | Select invitation/card type and template |
| `/builder/:id` | Edit content/theme, preview, save, and export |
| `/dashboard` | Saved events, publish/share/download, and RSVP filters |
| `/signin` | Connected Mode sign-in/sign-up; Demo Mode setup guidance |
| `/invite/:slug` | Public invitation and RSVP form (outside the app shell) |

Legacy `/#/...` links are migrated to path-based routes by `src/main.tsx`.

---

## Architecture (summary)

Invana is a **host → invite → guest** product. The static SPA never holds
privileged secrets. Supabase provides managed identity, Postgres, Storage, and
Edge Functions; adapters keep Demo and Connected Mode behind common contracts.

```
RenderInput (fields + templateId + theme)
        │
        ├─ Composition (SVG) → preview, PNG, PDF
        └─ InvitePage → public RSVP site
```

```mermaid
flowchart LR
  Host[Host SPA] --> Auth[Supabase Auth]
  Host --> DB[(Postgres + RLS)]
  Host --> Edge[Supabase Edge APIs]
  Guest[Guest SPA] --> Edge
  Edge --> DB
  Edge --> Storage[(event-media Storage)]
  Edge --> WhatsApp[WhatsApp Cloud API]
```

The frontend keeps `PersistenceProvider`, `StorageProvider`, `AuthProvider`,
and `MessagingProvider` contracts. Host event persistence and RSVP dashboard
reads currently use PostgREST; public and media paths prefer Edge Functions
with explicit fallbacks.

### Edge integration status

| Function | Purpose | SPA integration |
|----------|---------|-----------------|
| `invite` | Public published invite read | Used; PostgREST fallback |
| `rsvp` | Public RSVP write and host RSVP read | Public POST used; dashboard GET still uses PostgREST |
| `media` | Authenticated media upload + metadata | Used; direct Storage fallback |
| `events` | Publish/unpublish with durable-media validation | Deployed capability; SPA publish currently uses PostgREST |
| `og-invite` | Server-rendered crawler metadata | Requires a CDN/bot rewrite; not called by the SPA |
| `whatsapp-send` | WhatsApp Cloud API delivery | Used only with `VITE_MESSAGING_MODE=cloud` |
| `whatsapp-webhook` | Meta delivery-status webhook | External webhook endpoint |

**Invariants**

- Publish/export image fields are durable HTTPS Storage URLs in Connected Mode.
- Photos are compressed before upload, cover-cropped without stretching, and
  removed from Storage when replaced or when their event is deleted.
- Connected RSVP writes to the cloud system of record; failures never silently
  become local-only successes.
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
2. Apply all five migrations in filename order — see [supabase/README.md](supabase/README.md).
3. Deploy `invite`, `rsvp`, and `media` for the frontend’s primary Edge paths.
   Deploy `events`, `og-invite`, and `whatsapp-*` only for those optional capabilities.
4. Enable the Supabase Email provider for email/password auth.
   If email confirmation is enabled, users must confirm before the first session.
5. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (+ `VITE_PUBLIC_SITE_URL`).
6. Restart `npm run dev`; adapters switch to Connected Mode.
7. Sign in before cloud Save / Publish / Share.
8. Optional: `VITE_MESSAGING_MODE=cloud` after [WhatsApp setup](docs/whatsapp.md).

Without those Edge Functions, public invite reads and RSVP writes fall back to
PostgREST, while media upload falls back to direct Storage.

---

## Supabase media behavior

- Public-read bucket: `event-media`.
- Object path: `{userId}/{eventId}/media_*.{ext}`.
- JPEG, PNG, WebP, and GIF inputs are downsized and generally encoded to
  WebP/JPEG before upload.
- Stored objects are capped at 2 MB by client preparation, Media Edge, and the
  Storage bucket migration.
- Replacing/removing a photo deletes the old object; deleting an event removes
  its known objects before database cascade deletion.
- Immutable object names use a one-year CDN cache. Invite view and export use
  the same durable URL.

Existing Supabase projects should apply
`supabase/migrations/20260327000000_media_2mb.sql`.

## Data model: shipped vs scaffolded

Used by current product flows:

- `profiles` — auth-linked user profile.
- `events` — draft/published event plus canonical `RenderInput` JSON.
- `rsvps` — public responses and host dashboard reads.
- `event_media` + `event-media` Storage — media metadata and bytes.
- `api_rate_buckets` and `outbox_events` — Edge rate limits and RSVP outbox
  records (there is no outbox consumer yet).

The schema also includes `event_guests`, custom RSVP questions/answers,
`exports`, persisted `themes`, and WhatsApp campaign/log tables. These are
foundations for future product flows; they do not currently have complete UI
workflows. PNG/PDF export is client-side and does not write `exports`.

## Repository layout

```text
src/
  api/                  Event create/save/publish/delete facade
  auth/                 Session provider and sign-in gates
  components/           Builder, preview, invitation, layout, and UI
  config/               Event/card types and themes
  lib/                  Rendering, export, media, validation, SEO
  pages/                Route-level pages
  services/             Demo and Supabase adapters
  services/api/         Edge Function clients
  templates/            Template registry, fields, and layout factory
supabase/
  functions/            Logical APIs and WhatsApp functions
  migrations/           Schema, RLS, Storage, and Phase 1 migrations
docs/                   Architecture, deployment, and WhatsApp docs
```

---

## Current limitations

- Custom RSVP questions, guest-list management, saved DB themes, export history,
  and bulk campaign management are schema foundations, not finished UI flows.
- The SPA publishes events through PostgREST; the `events` Edge publish API is
  available but not wired into the frontend.
- The dashboard reads RSVPs through PostgREST; the Edge host-GET path is not used.
- `og-invite` requires a CDN/bot rewrite before social crawlers receive its HTML.
- Dynamic invitation URLs are not generated into the static sitemap.
- WhatsApp webhook tracking expects recipient rows/provider IDs; the current
  direct send path does not build a full campaign history.

---

## Hosting

| Target | Notes |
|--------|--------|
| **Netlify** (production) | https://invana.stream — SPA fallback in `netlify.toml` |
| **Vercel** | `vercel.json` rewrites — [docs/deployment.md](docs/deployment.md) |
| **GitHub Pages** | Legacy workflow on `main`/`master`; hash links migrate to path URLs |
| **Cloudflare Pages** | Documented setup only; no Cloudflare config file is committed |

App uses **BrowserRouter** (`/invite/:slug`). Old `/#/invite/...` links are redirected.

---

## Stack

| Area | Technology |
|------|------------|
| UI | React 18, TypeScript 5, Tailwind CSS 3 |
| Build | Vite 5 |
| Routing | React Router 6 (`BrowserRouter`) |
| Validation/state | Zod and React state/context |
| Rendering/export | SVG compositions, Canvas, jsPDF, qrcode |
| Backend | Supabase Auth, Postgres, RLS, Storage, Edge Functions |
| Messaging | WhatsApp `wa.me` and optional WhatsApp Cloud API |
| Quality | Vitest, ESLint, TypeScript |
| Hosting | Netlify production; Vercel/Cloudflare-compatible SPA |

Templates are original Invana compositions (see each template’s `license` metadata).

## Troubleshooting

- **Sign in is missing:** set both Supabase frontend variables and restart Vite.
  Demo Mode exposes `/signin` with setup guidance.
- **Storage is empty:** sign in, add a photo, and save. Demo Mode intentionally
  keeps photos in the browser.
- **Upload is rejected:** apply Storage migrations and verify `event-media`
  exists with owner write policies. Stored photos must be at most 2 MB.
- **A production deep route returns 404:** configure the included SPA fallback
  (`netlify.toml` or `vercel.json`).

## Security

Do not commit `.env`, service-role keys, WhatsApp tokens, or production secrets.
Report security issues privately to the repository owner.
