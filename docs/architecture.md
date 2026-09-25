# Architecture

## Boundary

The frontend is a static SPA. The browser never holds privileged secrets. Backend work (when connected) goes through Supabase with the anon/publishable key + RLS, and Edge Functions for WhatsApp tokens.

Hosting targets: GitHub Pages (hash routes), or dedicated hosts (Vercel / Netlify / Cloudflare) with SPA rewrite configs — see [deployment.md](deployment.md).

## Canonical render model

```
RenderInput = EventData fields + TemplateDefinition + Theme
        │
        ├─ Composition (SVG) → live preview, PNG, PDF
        └─ InvitePage (React) → responsive RSVP site
             └─ optional sections: countdown, map CTA, RSVP, footer
```

Both surfaces read the same `RenderInput`. Field resolution (`lib/fields.ts`) turns structured date/time and names into display strings once. Guest sections respect `config.sections` when present (`components/invitation/sectionVisibility.ts`).

## Adapters

| Interface | Demo Mode | Connected Mode |
|-----------|-----------|----------------|
| `PersistenceProvider` | `localStorage` (`services/demo.ts`) | Supabase `events` / `rsvps` |
| `AuthProvider` | local demo user | Magic-link via `services/supabase/auth.ts` |
| `MessagingProvider` | `wa.me` links | `wa.me` by default; Cloud API when `VITE_MESSAGING_MODE=cloud` |
| `StorageProvider` | object URLs (`activeStorage` → demo) | Supabase Storage `event-media` public URLs when signed in |

`src/services/index.ts` selects Demo when `VITE_SUPABASE_URL` / publishable key are unset.

## Folders

- `src/pages` — routes (marketing, wizard, builder, invite)
- `src/components/editor` — dynamic form, theme, share, publish, preview actions
- `src/components/invitation` — public invite sections (countdown, map)
- `src/templates` — registry + factories (data-driven, not one-off JSX pages)
- `src/lib/render` — SVG composition, motifs, text fitting
- `src/lib/export` — SVG → canvas PNG/JPEG; PDF via jsPDF
- `src/lib/supabase` — browser client factory
- `src/config` — event types, card types, themes, welcome messages
- `src/services` — provider interfaces + demo / supabase implementations
- `supabase/` — SQL migrations, RLS, Storage policies, Edge Function stubs

## Routing

`HashRouter` so `/#/invite/:slug` works on project Pages without a rewrite server. `vite.config` uses `base: './'`. Dedicated hosts also ship `vercel.json` / `netlify.toml` for path-style deep links if you switch to `BrowserRouter` later.

## Extending

- **New event type:** add to `EventTypeId` + `EVENT_TYPES` + `invitationFields` + welcome messages; associate templates in the registry.
- **New template:** call factories in `registry.ts` with palette, fonts, motif — do not rewrite existing templates.
- **Supabase:** adapters already live under `services/supabase/`; enable via env (see README).
