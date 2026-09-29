# Supabase Connected Mode

Ops guide for migrations, Storage, RLS, and Edge Functions.  
Product architecture: [docs/architecture.md](../docs/architecture.md) · frontend setup: [README](../README.md).

---

## Migrations

Apply **in order** (SQL editor or `supabase db push`):

| # | File | Purpose |
|---|------|---------|
| 1 | `migrations/20260324000000_init.sql` | Tables |
| 2 | `migrations/20260324000001_rls.sql` | Row Level Security |
| 3 | `migrations/20260324000002_storage.sql` | `event-media` bucket + policies |
| 4 | `migrations/20260326000000_phase1_api.sql` | `api_rate_buckets` + `outbox_events` |
| 5 | `migrations/20260327000000_media_2mb.sql` | Tighten existing `event-media` buckets to 2 MB |
| 6 | `migrations/20260928000000_event_management.sql` | Event Management `em_*` tables, RLS, check-in + rate-limit RPCs |
| 7 | `migrations/20260929000000_em_pass_holder.sql` | Pass holder name/role on `em_event_passes` |

Verify locally without a Supabase project (vanilla Postgres 14+ with `psql`):

```bash
npm run test:db     # applies migrations (storage ones skipped) twice + SQL assertions
npm run test:edge   # + PostgREST + Deno: runs the event-management repository end to end
```

---

## Storage (`event-media`)

Required for signed-in photo uploads. Public-read (invite guests + export CORS).

**Dashboard**

1. **Storage → New bucket** → name `event-media`, **Public: ON**  
2. File size limit: `2097152` (2 MB; client compresses before upload)
3. Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`  
4. Policies (or run the storage migration):
   - **SELECT** — public (`bucket_id = 'event-media'`)  
   - **INSERT / UPDATE / DELETE** — owner only (first path folder = `auth.uid()`)

Object path: `{user_id}/{event_id}/{filename}`.

**App behavior:** signed-in uploads prefer Media Edge (`functions/media`), then direct Storage. Save / claim promotes browser-local (`blob:` / `data:`) photos to HTTPS URLs. Demo / signed-out guests keep durable data URLs until sign-in.

---

## Tables (V1)

| Table | Purpose |
|-------|---------|
| `auth.users` | Canonical users (Supabase Auth) |
| `profiles` | Display name / avatar |
| `events` | Drafts + published sites (`config` JSONB = `RenderInput`) |
| `event_media` | Media metadata (binaries in Storage) |
| `event_guests` | Host guest list + WhatsApp opt-in |
| `rsvps` | Guest responses |
| `rsvp_questions` / `rsvp_answers` | Custom RSVP fields |
| `exports` | Export asset metadata |
| `themes` | Saved theme tokens |
| `message_campaigns` / `message_recipients` / `message_logs` | WhatsApp Cloud tracking |
| `api_rate_buckets` | Public Edge rate-limit counters (service role) |
| `outbox_events` | Async hooks (e.g. `rsvp.created`) — no consumer in V1 |
| `em_events` | Managed events (UUID id, random `public_id`, `slug` on publish, DRAFT/PUBLISHED/CANCELLED/COMPLETED) |
| `em_event_timeline` | Ordered schedule entries (`end_time > start_time`) |
| `em_event_guests` | Guests per managed event; unique active email/phone; capacity trigger |
| `em_event_passes` | One pass per guest; unique `public_id` + 256-bit `secure_token`; FK pins pass to the guest's event |
| `em_attendance` | Check-ins; one `CHECK_IN` per pass (`RE_ENTRY` reserved) |
| `em_event_staff` | Per-event door staff by email → `user_id` on first sign-in |
| `em_audit_log` | Append-only audit trail (mutations + every check-in attempt) |

---

## RLS summary

- Creators: own rows only (`auth.uid() = user_id`).  
- Published events: readable by anon + authenticated.  
- RSVP: anon **INSERT** when event is `published`; guests **cannot SELECT** (insert without `.select()`).  
- Hosts: **SELECT** RSVPs for their events.  
- `api_rate_buckets` / `outbox_events`: service role only.  
- Secrets (WhatsApp, service role) live only in Edge Functions.
- `em_*`: **read-only** for authenticated organizers (own events) and assigned staff
  (event row + timeline only — never guests or passes). No client writes, no anon
  access; `em_record_check_in` / `em_rate_limit_hit` are `service_role` only. All
  writes go through the `event-management` function, which enforces authorization.

---

## Edge Functions

| Function | Deploy | Role |
|----------|--------|------|
| `invite` | `supabase functions deploy invite` | Public invite GET by slug |
| `rsvp` | `supabase functions deploy rsvp` | Public RSVP POST + host GET |
| `media` | `supabase functions deploy media` | Authenticated upload + metadata |
| `events` | `supabase functions deploy events` | Publish / unpublish + durable-media check |
| `og-invite` | `supabase functions deploy og-invite` | OG HTML for crawlers |
| `whatsapp-send` | `supabase functions deploy whatsapp-send` | Cloud API send |
| `event-management` | `supabase functions deploy event-management` | Managed events, guests, passes, check-in, attendance (JWT + public routes) |
| `whatsapp-webhook` | `supabase functions deploy whatsapp-webhook --no-verify-jwt` | Meta webhooks |

Shared helpers: `functions/_shared/` (CORS, `x-request-id`, rate limit, slug, invite projection).
Event Management domain + router: `functions/_shared/event-core/` (also imported by the SPA via `@event-core`).

### Deploy Phase 1 set

```bash
supabase functions deploy invite
supabase functions deploy rsvp
supabase functions deploy media
supabase functions deploy events
supabase functions deploy og-invite
```

### Deploy Event Management

One command (applies migrations 6–7 with psql, sets secrets, deploys the function):

```bash
SUPABASE_ACCESS_TOKEN=sbp_… \
SUPABASE_DB_URL='postgresql://postgres.<ref>:<db-password>@<pooler-host>:5432/postgres' \
supabase/deploy-event-management.sh
```

Manual equivalent:

```bash
# run 20260928000000_event_management.sql then 20260929000000_em_pass_holder.sql in the SQL editor
supabase functions deploy event-management        # default verify_jwt: anon key works for public routes
supabase secrets set EM_MAX_CAPACITY=10000        # optional; mirror in VITE_EVENT_MAX_CAPACITY
supabase secrets set EM_PASS_BATCH_SIZE=50        # optional; passes per generate request
```

Staff access binds by **confirmed** email — keep email confirmation enabled in
Auth settings, otherwise someone could sign up with a staff address. Rate limits
fail **closed** if `em_rate_limit_hit` is missing, so apply the migration before
deploying the function.

### Secrets

```bash
# WhatsApp (see docs/whatsapp.md)
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_BUSINESS_ACCOUNT_ID=... \
  WHATSAPP_WEBHOOK_VERIFY_TOKEN=...

# Optional — absolute URLs in og-invite
supabase secrets set PUBLIC_SITE_URL=https://invana.stream
```

Never put these in `VITE_*` env vars.

Until functions are deployed, the SPA falls back to PostgREST for invite GET / RSVP insert and to direct Storage for uploads.

---

## Verify

1. Migrations 1–5 applied; bucket public.
2. Phase 1 functions deployed.  
3. Frontend Connected env set; `npm run dev` / production host rebuilt.  
4. Sign in → upload photo → Save → object under `event-media/{uid}/…` → Download PNG includes photo.  
5. Publish → `/invite/{slug}` → RSVP from another browser → row in `rsvps` → host **My events**.  
6. `npm test && npm run typecheck && npm run build`.
