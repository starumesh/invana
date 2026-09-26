# WhatsApp Business Cloud API

Invana talks to Meta only through Supabase Edge Functions (`whatsapp-send`, `whatsapp-webhook`).  
The browser never sees access tokens. See [architecture.md](architecture.md) (Messaging service).

---

## Modes (`VITE_MESSAGING_MODE`)

| Value | Behavior |
|-------|----------|
| unset / `wa_me` | `wa.me` click-to-chat (Connected Mode default) |
| `demo` | `wa.me` (Demo Mode) |
| `cloud` | Calls Edge Function `whatsapp-send` (requires Meta + secrets) |

Cloud mode **does not fake success**. If the function or secrets are missing, each recipient returns `status: "failed"` with an actionable error.

---

## Setup

1. Create a Meta WhatsApp Business app; obtain a permanent access token, phone number ID, and webhook verify token.  
2. Deploy functions:

```bash
supabase functions deploy whatsapp-send
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

3. Set secrets (Supabase project — never `VITE_*`):

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_BUSINESS_ACCOUNT_ID=... \
  WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

4. Point Meta’s webhook URL at the `whatsapp-webhook` function URL; subscribe to message status fields.  
5. In the frontend env:

```bash
VITE_MESSAGING_MODE=cloud
```

---

## Compliance

- Business-initiated outreach needs **pre-approved message templates** and recipient opt-in.  
- The send stub posts session/text or media-link payloads for development — swap in template payloads before production bulk sends.  
- `wa.me` remains for ad-hoc personal shares; do not label it as Cloud API delivery.  
- Bulk fan-out / webhook lag belong to async Messaging + Jobs (Phase 2+); single-recipient `wa.me` does not need a queue.
