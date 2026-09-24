# Supabase Connected Mode

## Migrations

Apply in order from the Supabase SQL editor (or CLI):

1. `migrations/20260324000000_init.sql` — tables
2. `migrations/20260324000001_rls.sql` — Row Level Security
3. `migrations/20260324000002_storage.sql` — `event-media` bucket + policies

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

## RLS summary

- **Creators** access only their own rows (`auth.uid() = user_id` / `profiles.id`).
- **Published events** are readable by anyone (anon + authenticated) for the public invite page.
- **RSVP insert** allowed when the target event is `published`; guests **cannot** `SELECT` the guest list.
- **Hosts** can `SELECT` RSVPs for their events.
- **WhatsApp secrets** never live in the browser — Edge Functions use the service role + Meta tokens.

## Edge Functions

See `functions/whatsapp-send/` and `functions/whatsapp-webhook/`. Set secrets with:

```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_BUSINESS_ACCOUNT_ID=... WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

Never put these in `VITE_*` env vars.
