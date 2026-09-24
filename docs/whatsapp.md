# WhatsApp Business Cloud API

Invana talks to Meta only through Supabase Edge Functions. The browser never sees access tokens.

## Modes (`VITE_MESSAGING_MODE`)

| Value | Behavior |
|-------|----------|
| `demo` / unset (Demo Mode) | `wa.me` click-to-chat links |
| `wa_me` | Same `wa.me` fallback while Connected Mode persistence is on |
| `cloud` | Calls Edge Function `whatsapp-send` (requires Meta + secrets) |

Cloud mode **does not fake success**. If the function or secrets are missing, each recipient returns `status: "failed"` with an actionable error.

## Setup

1. Create a Meta WhatsApp Business app and get a permanent access token, phone number ID, and (for webhooks) a verify token.
2. Deploy functions:

```bash
supabase functions deploy whatsapp-send
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

3. Set secrets:

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_BUSINESS_ACCOUNT_ID=... \
  WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

4. Point Meta’s webhook URL at your `whatsapp-webhook` function URL; subscribe to `messages` status fields.
5. In the frontend `.env`:

```
VITE_MESSAGING_MODE=cloud
```

## Compliance notes

- Business-initiated outreach needs **pre-approved message templates** and recipient opt-in.
- The send stub currently posts session/text or media-link payloads for development; swap in template payloads before production bulk sends.
- `wa.me` remains available for ad-hoc personal shares and must not be labeled as Cloud API delivery.
