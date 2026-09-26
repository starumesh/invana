# Supabase Connected Mode

## Migrations

Apply in order from the Supabase SQL editor (or CLI):

1. `migrations/20260324000000_init.sql` — tables
2. `migrations/20260324000001_rls.sql` — Row Level Security
3. `migrations/20260324000002_storage.sql` — `event-media` bucket + policies
4. `migrations/20260326000000_phase1_api.sql` — rate-limit buckets + RSVP outbox (Phase 1)

### Storage bucket (required for signed-in photo uploads)

If builder uploads fail with bucket/policy errors, or objects never appear under **Storage**, apply the storage migration (or run the steps below).

**SQL editor** — paste and run `migrations/20260324000002_storage.sql` in full.

**Or Dashboard:**

1. **Storage → New bucket**
   - Name: `event-media`
   - Public bucket: **ON** (invite guests need to load photos via public URLs)
   - File size limit: `10485760` (10 MB)
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
2. If the bucket already exists but is private: open it → **Configuration** → set **Public** to on (or re-run the migration `on conflict` update).
3. **Storage → Policies** for `event-media` (or run the SQL policies in the migration):
   - **SELECT** — public read (`bucket_id = 'event-media'`)
   - **INSERT / UPDATE / DELETE** — owner only: first path folder equals `auth.uid()`

Object path convention: `{user_id}/{event_id}/{filename}`.

Signed-in uploads prefer Media Edge (`functions/media`) then fall back to direct Storage. Save / claim promotes browser-local photos to durable HTTPS URLs. Demo Mode / signed-out guests keep durable data URLs until sign-in.

## Tables (V1)

| Table | Purpose |
|-------|---------|
| `auth.users` | Canonical users (Supabase Auth) |
| `profiles` | Display name / avatar for creators |
| `events` | Invitation/card drafts + published sites (`config` JSONB = `RenderInput`) |
| `event_media` | Media metadata (binaries in Storage) |
| `event_guests` | Host guest list + WhatsApp opt-in |
| `rsvps` | Guest responses |
| `rsvp_questions` / `rsvp_answers` | Custom RSVP fields |
| `exports` | Export asset metadata |
| `themes` | Saved theme tokens |
| `message_campaigns` / `message_recipients` / `message_logs` | WhatsApp Cloud API tracking |
| `api_rate_buckets` | Fixed-window counters for public Edge routes (service role) |
| `outbox_events` | Async hooks (e.g. `rsvp.created`) — no email worker in V1 |

## RLS summary

- **Creators** access only their own rows (`auth.uid() = user_id` / `profiles.id`).
- **Published events** are readable by anyone (anon + authenticated) for the public invite page.
- **RSVP insert** allowed when the target event is `published`; guests **cannot** `SELECT` the guest list.
  Client / Edge inserts use `insert` without `.select()` so anon RSVPs from other devices succeed (RETURNING would fail host-only SELECT RLS).
- **Hosts** can `SELECT` RSVPs for their events.
- **WhatsApp secrets** never live in the browser — Edge Functions use the service role + Meta tokens.
- **`api_rate_buckets` / `outbox_events`** — service role only (no anon policies).

## Edge Functions (logical services)

| Function | Deploy | Role |
|----------|--------|------|
| `invite` | `supabase functions deploy invite` | Public invite GET by slug |
| `rsvp` | `supabase functions deploy rsvp` | Public RSVP POST + host GET |
| `media` | `supabase functions deploy media` | Authenticated upload + metadata |
| `events` | `supabase functions deploy events` | Publish / unpublish (durable media check) |
| `og-invite` | `supabase functions deploy og-invite` | OG HTML shell for crawlers |
| `whatsapp-send` / `whatsapp-webhook` | existing | Messaging |

Shared helpers live under `functions/_shared/` (CORS, request IDs, rate limit, slug, projection).

Set WhatsApp secrets with:

```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_BUSINESS_ACCOUNT_ID=... WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

Optional for OG absolute URLs:

```bash
supabase secrets set PUBLIC_SITE_URL=https://invana.stream
```

Never put these in `VITE_*` env vars.

Until Edge Functions are deployed, the SPA falls back to PostgREST for invite GET / RSVP insert / Storage upload.
