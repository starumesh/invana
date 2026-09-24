# Event Invitation & Bio Card Platform — Product Requirements

**Product:** Premium invitation + bio card + live guest website + RSVP + WhatsApp distribution platform  
**Hosting:** Dedicated frontend hosting (e.g. Vercel, Netlify, Cloudflare Pages, or custom domain + CDN) with a real backend (Supabase).  
**Services:** Paid services are allowed and expected where they improve quality (WhatsApp Business Cloud API, managed DB/storage, email, analytics, CDN).  
**Stack:** React + TypeScript + Vite · Tailwind + shadcn/ui · Supabase · Zod · WhatsApp Business Cloud API

---

## 1. How to use this document

Requirements use build-order tags where sequencing matters:

| Tag | Meaning |
|-----|---------|
| **V1** | Required for the first production-quality release. |
| **V1.1** | Ships right after the V1 core path is stable; still part of the quality bar. |
| **V2** | Next product depth after V1/V1.1. Architecture must leave clean extension points. |

Two technical anchors apply everywhere:

1. **Canonical rendering model** — one `EventData + TemplateDefinition + Theme` drives preview, PNG, PDF, and the live invitation site.
2. **Provider adapters** — persistence, auth, storage, and messaging sit behind interfaces. Demo adapters support local development; **Connected Mode (Supabase + WhatsApp Cloud API) is the product default.**

---

## 2. Product vision

Hosts create beautiful event invitations and bio/profile cards, export print-quality assets, publish a live guest website, collect RSVPs, and distribute invitations via WhatsApp Business Cloud API (templates, media, bulk sends, delivery status). Guests open a link on mobile and see the invitation immediately — no account required.

The platform must be production-grade: premium UX, solid architecture, export fidelity, security, and messaging. Do not ship a toy MVP that permanently under-scopes quality.

### 2.1 Quality bar (non-negotiable)

| Area | Must |
|------|------|
| **Export fidelity** | Preview equals export. Vector-capable PDF; crisp PNG/JPEG at 2×/3×. Never viewport screenshots. |
| **Template quality** | Real compositions (typography, hierarchy, motifs, QR placement) — not text on a background image. |
| **Mobile guest UX** | Invitation usable in under 3 taps from WhatsApp open; thumb-friendly CTAs; fast on 4G. |
| **Accessibility** | WCAG 2.1 AA for creator UI and guest web invitation. |
| **Security** | Supabase RLS on all tables; secrets server-side only; validated uploads; rate-limited public endpoints. |
| **WhatsApp** | Business Cloud API for real sends (media, templates, bulk with opt-in, webhook status). `wa.me` is a lightweight fallback only. |
| **Hosting** | Dedicated frontend hosting + Supabase backend; edge/server support for share previews and privileged APIs. |
| **Testing** | Unit, component, and E2E gates green before a feature is “done.” |
| **Licensing** | Original or properly licensed templates/assets only. Do not scrape Canva, Greetings Island, Pinterest, or other copyrighted designs. |

### 2.2 Scope & scale assumptions

- **In scope:** Invitation builder, bio cards, live website, RSVP, media, WhatsApp Cloud API, dedicated hosting.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions) for Connected Mode from the start.
- **Paid services OK:** WhatsApp Business Cloud API, Supabase paid plan if needed, Resend (or equivalent email), analytics, CDN, custom domain.
- **Expected scale (first 6–12 months):** under 100 concurrent creators; ~500–5,000 events/month; ~20–50k RSVPs/month; low tens of GB media. Managed Supabase + CDN hosting is sufficient; add queues/workers when volume demands it.

---

## 3. Architecture

### 3.1 System overview

```
┌──────────────────────────────────────────────────────────────┐
│  Dedicated hosting (Vercel / Netlify / Cloudflare / CDN)       │
│  • Marketing + docs                                             │
│  • Creation wizard, template engine, live preview               │
│  • Canonical composition renderer → PNG / JPEG / PDF (client)   │
│  • QR generation                                                │
│  • Public invitation website (SPA or hybrid; deep links work)   │
│  • Edge/server functions for OG tags, privileged proxies        │
│  • Adapters: Persistence · Auth · Messaging · Storage           │
└───────────────┬────────────────────────────────────────────────┘
                │ HTTPS · anon/publishable key · RLS-guarded
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase — backend                                             │
│  • Postgres + Row-Level Security                                │
│  • Auth (magic-link email)                                      │
│  • Storage (media; signed URLs for private)                     │
│  • Edge Functions (WhatsApp send, webhooks, slug checks,        │
│    notifications) — hold all secrets                            │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Hosting acceptance criteria

- **AC-3.1** Production deploy uses dedicated hosting with custom domain support and HTTPS.
- **AC-3.2** Frontend never embeds WhatsApp tokens, service-role keys, or other secrets.
- **AC-3.3** Deep links (`/invite/<slug>`) resolve without 404 on refresh (host rewrite rules or equivalent).
- **AC-3.4** Share previews (Open Graph) work for WhatsApp and other scrapers that do not execute JS — via edge/server-rendered meta or pre-generated share pages.

### 3.3 Architectural principles

- Adapters allow Demo ↔ Connected swap without rewriting product UI.
- Event `config` as JSONB evolves template/field schemas without constant migrations.
- RLS provides multi-tenant isolation without a custom auth server.
- Edge Functions own WhatsApp, webhooks, and privileged checks.

---

## 4. Canonical rendering model

One source of truth for preview, image export, PDF export, and the web invitation:

```
RenderInput = EventData + TemplateDefinition + Theme
```

Two renderers consume `RenderInput`; they must not diverge on content, only on medium:

1. **Composition renderer → SVG** (print/card): fixed template dimensions; exact artwork for preview thumbnails, PNG/JPEG (rasterized), and PDF (vectorized).
2. **Interactive web renderer → responsive React** (web): same data/theme/sections for the live invitation — responsive, scrollable, animated. Not a shrunken print card.

**Requirements:**
- **FR-4.1** Every dynamic element references a field (e.g. `{ type: "text", field: "hostNames" }`, `{ type: "qr", field: "locationUrl" }`).
- **FR-4.2** User-facing preview uses the same composition renderer as export (same code path, fonts, layout).
- **FR-4.3** Long-content handling (wrapping, bounded font-scaling, truncation, alternate layouts) lives in the renderer so preview and export stay identical.

**Acceptance:** Export of a filled invitation matches on-screen composition (fonts embedded; no missing glyphs; QR scannable).

---

## 5. Event types & creation wizard

### 5.1 Event types (V1)

First screen: **“What are you creating?”** with visually rich category cards:

Wedding · Engagement · Birthday · Gruha Pravesham · Sangeet · Haldi · Baby Shower · Anniversary · Reception · Housewarming · Naming Ceremony · Mehendi · Save the Date · Party · Custom Event.

- **FR-5.1** Event types are data/config, not code branches. Adding a type means a registry entry plus templates.

### 5.2 Creation wizard (V1)

Guided steps with progress and no dead ends:

1. Select Event Type → 2. Select Template → 3. Enter Details → 4. Add Photos/Media → 5. Customize Style → 6. Preview → 7. Export / Publish / Share.

- **FR-5.2** Autosave drafts between steps.
- **FR-5.3** Target path: Choose → Customize → Preview → Download/Publish → Share → Track RSVP.
- **AC-5.1** A non-technical user completes a full invitation end-to-end in under 5 minutes with no written instructions.

---

## 6. Template engine & metadata

### 6.1 Data-driven templates (V1)

Templates are definitions, not JSX pages.

```ts
type TemplateDefinition = {
  id: string;
  name: string;
  eventTypes: EventTypeId[];
  category: string;
  tags: string[];
  orientation: "portrait" | "landscape" | "square";
  dimensions: {
    width: number; height: number; unit: "px" | "mm" | "in";
    aspectRatio: number; printWidth: number; printHeight: number;
  };
  background: BackgroundSpec;
  fonts: FontSpec[];
  colors: ColorTokens;
  assets: AssetRef[];
  elements: ElementSpec[];
  fields: FieldSpec[];
  sections?: SectionSpec[];
  preview: string;
  license: {
    source: string;
    license: string;
    attribution?: string;
    commercialUseAllowed: boolean;
  };
};
```

- **FR-6.1** Every template carries full metadata including license/source.
- **FR-6.2** On-disk layout: `templates/<eventType>/<template>/{definition.ts, assets/, preview.webp}` — auto-registered at build time.

### 6.2 Category taxonomy

Ship curated categories per event type (examples):

- **Wedding:** Traditional · Elegant · Minimal · Floral · Royal · Modern · Telugu · Tamil · Kannada · Malayalam · North Indian · South Indian · Luxury · Dark · Pastel
- **Engagement:** Elegant · Minimal · Romantic · Floral · Modern
- **Birthday:** Kids · Adult · Luxury · Fun · Minimal · Photo-based · Dark · Colorful
- **Gruha Pravesham:** Traditional · Telugu · South Indian · Minimal · Modern
- **Haldi:** Floral · Yellow · Traditional · Modern · Luxury
- **Sangeet:** Royal · Bollywood-inspired · Modern · Dark · Festive

### 6.3 Template quality bar

Templates must define typography, hierarchy, spacing, alignment, image treatment, decorative elements, background, colors, icons, QR placement, and responsive web behavior. Never allow clipped names, overlapping text, broken layouts, QR collisions, or unreadable text.

### 6.4 Long content & print safety

- **FR-6.4** Renderer handles short through very long names/venues/addresses/messages.
- **FR-6.5** Print-safety: safe margins, bleed, crop safety, minimum font size, QR quiet zone; warn when content exceeds safe areas.
- **FR-6.6** Dimensions are per-template — never global constants.

### 6.5 Licensing

- Do not scrape or copy Canva, Greetings Island, Pinterest, or copyrighted designs. Use them for inspiration only.
- Build original templates or use properly licensed assets (Google Fonts, Lucide, Unsplash/Pexels per license, commissioned art).
- Persist `assetSource / license / attribution / commercialUseAllowed` for every asset and template.
- Canva remains a future optional authorized integration under `integrations/canva/`; the core engine must not depend on it.

### 6.6 Template admin readiness (V2)

Design so a future admin can add event types, templates, categories, previews, fonts, assets, themes, field mappings, licenses, and featured flags without code changes. V1 does not require the admin UI; the registry must leave room for it.

---

## 7. Forms, date, welcome message, venue

### 7.1 Dynamic form (V1)

- **FR-7.1** Form renders from the selected template’s `fields`, validated with Zod.

### 7.2 Structured date/time (V1)

- **FR-7.2** Collect Day / Month / Year / Time, optional Timezone, 12h/24h support. Store structured values; format for display per template/locale. Never store only a free-text date string.

### 7.3 Welcome message (V1)

- **FR-7.3** Polished predefined messages plus a custom-message option.

### 7.4 Venue (V1)

- **FR-7.4** Collect venue name, address, city, state, country, Google Maps URL; provide “Open in Google Maps”; preserve the location URL in invitation and exports.

---

## 8. QR code (V1)

- **FR-8.1** Every printable template supports an optional QR for Maps URL, event website URL, or custom URL.
- **FR-8.2** Use a real QR library; prefer SVG; enforce high contrast, quiet zone, sufficient size, and error correction. No blurry screenshot QR.
- **FR-8.3** Validate that the generated QR resolves to the intended URL in the export pipeline.

---

## 9. Export system

Exports must be generated from structured design data via the canonical renderer — never browser-viewport screenshots.

### 9.1 Fidelity

Preserve layout, fonts, QR codes, positioning, and aspect ratio. No shifting, clipping, blurring, or incorrect cropping.

### 9.2 Image export — PNG/JPEG (V1)

- **FR-9.1** Rasterize composition SVG at 2×/3×. Presets: Digital ≥ 1080px width; High-res ≥ 2160px; Print ~300 DPI equivalent. Preserve transparency when the template requires it (PNG).

### 9.3 PDF export (V1)

- **FR-9.2** Generate PDF from SVG with vector text and embedded fonts/images (`svg2pdf.js` + `jsPDF` or equivalent). Correct physical size; safe/bleed areas; no browser chrome.
- **FR-9.3** Support common invitation sizes: 5×7 in, A5, A4, Square, Mobile portrait — template defines its physical size.
- **FR-9.4** Optional SVG export.

### 9.4 Reliability (V1)

- **FR-9.5** On failure: keep design state, allow retry, never lose data, show an actionable error.
- Embed/inline fonts in SVG; use CORS-safe images; render off-screen at fixed dimensions independent of viewport.

**Acceptance:** Side-by-side review of preview vs PNG vs PDF for long names shows no clipping, wrong fonts, or unscannable QR.

---

## 10. Live invitation website

### 10.1 Publish & slugs (V1)

- **FR-10.1** A completed invitation can publish at `/invite/<slug>`.
- **FR-10.2** Slugs are unique, URL-safe, normalized, editable, and availability-checked; uniqueness enforced in DB and via Edge Function.

### 10.2 Personalized guest URLs (V1.1)

- **FR-10.3** Optional guest token URL shows “Dear &lt;Name&gt;”. Resolve name from token; never leak the full guest list.

### 10.3 Sections

Independently enable/disable: Hero · Welcome · Countdown · Event details · Multiple functions · Couple/person profile · Our story · Family · Schedule · Venue · Google Maps · Directions · RSVP · Photo gallery · Video · Background music · Guest wall · Wishes · Guest photos · Accommodation · Dress code · Travel · Contact · Gift/registry · Footer.

- **V1 must include:** Hero, Welcome, Event details, Venue/Map/Directions, RSVP, Footer, Countdown, basic Gallery.
- **V1.1 / V2:** Our story, Schedule, multi-event, Guest wall, Photo wall, Video, Music, Accommodation/Travel/Dress code/Gift.

### 10.4 Multi-event weddings (V1.1)

- **FR-10.4** One invitation site can hold multiple functions (Haldi, Mehendi, Sangeet, Wedding, Reception), each with its own details, map, and QR.

### 10.5 Guest-first experience (V1)

- **FR-10.5** Opening a link shows the invitation immediately — no account, no navigation gate. First screen prioritizes name, date, venue, main visual, and RSVP CTA. Mobile-first sticky CTAs for RSVP, map, and call.

### 10.6 SEO & share previews (V1)

- **FR-10.6** Public pages set title, description, Open Graph, and event image.
- **FR-10.7** Deep links must work on the production host via rewrite/fallback rules.
- **FR-10.8** Non-JS scrapers must receive correct OG meta via server/edge rendering or static share pages.

### 10.7 Privacy modes (V1.1)

- **FR-10.9** Per-event visibility: Public / Unlisted / Password-protected. Host can disable guest-list visibility, guest wall, photo wall, and comments.

---

## 11. RSVP system

### 11.1 Guest RSVP (V1)

- **FR-11.1** Accept / Decline / Maybe. Optional: name, phone, email, attendee count, plus-ones, dietary preference, custom questions, message to host.
- **FR-11.2** No guest account. Flow: open → RSVP → required questions → submit.
- **FR-11.3** Public RSVP write via insert-only RLS or Edge Function scoped to that event; guests cannot read the guest list unless the host enables visibility.

### 11.2 RSVP admin dashboard (V1)

- **FR-11.4** Totals, Attending/Declined/Maybe/Pending, guest counts, plus-ones, dietary prefs, custom responses.
- **FR-11.5** Search, filters, sorting, CSV export, response timeline, guest details, host status changes.

**Acceptance:** Publish → open public URL on mobile → submit RSVP → appear in host dashboard within seconds; CSV includes all fields.

---

## 12. Guest wall, photo wall, media, music

### 12.1 Guest wall (V1.1)

- **FR-12.1** Guests leave wishes/messages/photos. Host controls enable/disable, moderation, visibility, delete/hide.

### 12.2 Photo wall (V1.1)

- **FR-12.2** Guests upload event photos; host approves/deletes/hides/downloads. Store binaries in Supabase Storage — never large media in Postgres.

### 12.3 Media support

- **FR-12.3** Images (JPG/PNG/WebP) in V1; video (MP4/WebM) and audio (MP3/AAC/M4A) in V1.1; PDF as needed.
- **FR-12.4** Validate MIME, extension, size, dimensions; show upload progress; lazy-load; generate thumbnails where practical; compress images client-side before upload.

### 12.4 Background music (V1.1)

- **FR-12.5** Host uploads or picks licensed built-in audio; respect browser autoplay rules; always show a visible music control.

---

## 13. Card / bio creator

Top-level product **“Create a Card”**, sharing the invitation rendering/export engine with independent card templates.

### 13.1 Card types

Marriage Bio · Dating Bio · Personal Introduction · Conference Speaker · Seminar Speaker · Professional Profile · Birthday Profile · Family Introduction · Event Host · Custom Profile Card.

- **FR-13.1** Type-specific forms; optional fields in expandable sections.
- **FR-13.2 Marriage Bio fields:** name, photo, DOB, age, height, education, profession, location, languages, family, parents, siblings, hobbies, contact, about.
- **FR-13.3 Professional/Conference fields:** name, photo, title, company, experience, expertise, education, bio, website, LinkedIn, email, phone, socials; QR for LinkedIn/website/contact/custom URL.
- **FR-13.4** Categories: Premium · Minimal · Professional · Elegant · Traditional · Modern · Dark · Luxury · Playful.

### 13.2 Initial card templates (V1)

Marriage Bio ×2, Dating Bio ×1, Conference/Seminar Bio ×2 — photo upload in Connected Mode.

---

## 14. Design customization & themes (V1)

- **FR-14.1** Presets first: Classic · Elegant · Royal · Modern · Minimal · Festive. Advanced controls behind disclosure.
- **FR-14.2** Customizable: palette, font, alignment, background, border, image + position, section visibility, accent, spacing. Do not expose hundreds of controls.
- **FR-14.3** Print template visual language carries into the web invitation theme without breaking design identity.

---

## 15. WhatsApp & messaging

### 15.1 Abstraction (V1)

- **FR-15.1** UI calls `sendWhatsAppInvitation()`; provider logic sits behind `MessagingProvider`:

```ts
interface MessagingProvider {
  sendText(...): Promise<SendResult>;
  sendImage(...): Promise<SendResult>;
  sendVideo(...): Promise<SendResult>;
  sendAudio(...): Promise<SendResult>;
  sendDocument(...): Promise<SendResult>;
  getDeliveryStatus?(messageId: string): Promise<DeliveryStatus>;
}
```

Config is environment-driven. UI must not hardcode provider-specific assumptions.

### 15.2 WhatsApp Business Cloud API (V1 — primary)

- **FR-15.2** Implement via Supabase Edge Function (or equivalent). Access token never touches the browser. Secrets: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, webhook verify token.
- **FR-15.3** Support text, image, video, audio, document. Validate type/size → upload → obtain media ID or public URL → send. Retry failures; track pending / sent / delivered / failed / read as the API provides.
- **FR-15.4** Process status webhooks on a backend endpoint; persist to `message_logs`.
- **FR-15.5** Compliance: business-initiated messages use pre-approved templates; recipients have opt-in; respect Meta policies and pricing. Template catalog must be configurable without UI rewrites.
- **FR-15.6** Bulk send with opt-in: select recipients → select invitation → optional message/media → preview → confirm → send → show per-recipient status. Validate country code, phone format, duplicates, invalid numbers.

**Acceptance:** Host sends a template + media invitation to a test number via Cloud API; dashboard shows webhook-driven delivery status; failures surface actionable errors.

### 15.3 `wa.me` fallback

- **FR-15.7** Compliant `wa.me` click-to-chat remains available for single-recipient text+link shares when Cloud API is not configured or for ad-hoc personal sends. It cannot pre-attach media and must not be presented as equivalent to Cloud API.

### 15.4 Demo MessagingProvider

- **FR-15.8** Demo adapter simulates send results for local/dev without credentials. Must not fabricate production delivery. UI clearly labels Demo vs Connected.

---

## 16. Data model

### 16.1 Canonical config type (V1)

```ts
type RenderInput = {
  schemaVersion: 1;
  kind: "invitation" | "card";
  eventType?: EventTypeId;
  cardType?: CardTypeId;
  templateId: string;
  fields: Record<string, unknown>;
  theme: ThemeTokens;
  sections?: SectionConfig[];
};
```

### 16.2 Persistent schema (Supabase)

Separate template definition, user event data, and generated files; the renderer combines them at runtime.

**V1 tables:** `users`, `profiles`, `events` (`id, user_id, kind, event_type, template_id, config jsonb, slug unique, status, created_at, updated_at`), `event_media`, `event_guests`, `rsvps`, `rsvp_questions`, `rsvp_answers`, `exports`, `themes`, `message_campaigns`, `message_recipients`, `message_logs`.

**V1.1 / V2 tables:** `event_types`, `templates`, `template_categories`, `event_templates`, `event_sections`, `guest_messages`, `guest_photos`, `shares`, `assets` (when admin-driven catalog lands).

- **FR-16.1** Media metadata in Postgres; binaries in Supabase Storage.
- **FR-16.2** Store event `config` as JSONB.
- **FR-16.3** Store structured date/time/timezone — never only formatted strings.
- **FR-16.4** Message campaign/log tables ship in V1 to support Cloud API status tracking.

---

## 17. Security & privacy

- **FR-17.1** Supabase RLS on every table: creators access only their own rows.
- **FR-17.2** Public read only for published invitation public fields. Public RSVP insert limited to the target event.
- **FR-17.3** Backend secrets only; signed URLs for private content.
- **FR-17.4** Upload validation (MIME/size/dimensions), input sanitization, XSS prevention, CSRF-aware backend patterns, rate limiting on RSVP, slug check, and messaging.
- **FR-17.5** Guests view public event data and submit RSVP; they cannot enumerate guests unless the host enables visibility.
- **FR-17.6** WhatsApp webhook endpoint verifies signatures/tokens; reject unauthenticated callbacks.

---

## 18. Non-functional requirements

### 18.1 Product behaviors (V1)

- **Autosave:** debounced saves, draft status, last-saved timestamp, optimistic UI; states Saved / Saving… / Unable to save. Never lose work.
- **Duplicate event:** clone then edit names, date, venue, template, photos.

### 18.2 NFR table

| Priority | Category | Requirement |
|----------|----------|-------------|
| P0 | Compatibility | Modern mobile and desktop browsers; mobile-first. |
| P0 | Performance | Builder interactive under 3s on 4G; preview feels instant; export under 5s typical; route-level code-splitting; lazy-load heavy libs and media. |
| P0 | Usability | Non-technical user completes an invitation in under 5 minutes with no instructions. |
| P0 | Reliability | Exports, saves, and messaging fail loudly with recovery — never silently. |
| P0 | Security | RLS, server-side secrets, rate limits, upload validation. |
| P0 | Accessibility | WCAG 2.1 AA for creator and guest surfaces. |
| P1 | Observability | Analytics (views, RSVP conversion, shares) + error tracking (e.g. Sentry). |
| P1 | Scalability | Meet §2.2 scale on managed services; add workers/queues when volume requires. |
| P1 | i18n | Architecture-ready in V1; translations roll out progressively. |

---

## 19. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript | Safety and tooling |
| Framework | React + Vite | Fast DX; portable build to dedicated hosts |
| Styling | Tailwind | Consistent premium UI |
| Components | shadcn/ui (Radix) | Accessible primitives you own |
| Rendering | Custom SVG composition renderer | One model → preview + exports |
| Image export | Canvas rasterization @2×/3× of SVG | Crisp, no screenshots |
| PDF export | svg2pdf.js + jsPDF | Vector text + embedded fonts |
| QR | qrcode / qr-code-styling (SVG) | Print-quality QR |
| Forms | react-hook-form + zod | Typed forms and contracts |
| Routing | react-router + host rewrites | Deep links on production host |
| State | React state + zustand where needed | Avoid one giant store |
| i18n | i18next / react-i18next | No hardcoded strings |
| Backend | Supabase | Auth, persistence, media, privileged APIs |
| Messaging | WhatsApp Business Cloud API | Templates, media, bulk, webhooks |
| Email | Resend (or equivalent) | Notifications |
| Analytics | Plausible or GA4 | Funnel metrics |
| Errors | Sentry (or equivalent) | Production failure visibility |
| Hosting | Vercel / Netlify / Cloudflare Pages (+ custom domain / CDN) | Production frontend + edge/server |
| CI/CD | GitHub Actions → target host | Lint → test → build → deploy |
| Testing | Vitest + RTL + Playwright | Unit / component / E2E |

---

## 20. Code architecture

```
src/
  components/{ui, editor, invitation, cards, rsvp, media, whatsapp}/
  features/{events, templates, exports, rsvp, messaging, profiles}/
  pages/  layouts/
  lib/{supabase, qr, export, validation, render}/
  templates/{wedding, engagement, birthday, gruhapravesham, sangeet, haldi, cards}/
  services/{events, templates, exports, messaging, storage}/
  providers/{whatsapp, future}/
  integrations/canva/
  i18n/messages/
  types/  hooks/  utils/  config/
```

Principles:

- Rendering, data (`RenderInput`), export, distribution, and persistence are independent modules with small interfaces.
- Adapters in `services/*` and `providers/*` expose Demo and Connected implementations; env selects the mode.
- Comment the why, not the what.
- Build seams now (interfaces, registries, JSONB). Do not invent microservices, unused plugin frameworks, or a custom auth server.

---

## 21. UI/UX & design system

### 21.1 Design system (V1)

Consistent spacing and typography; buttons, inputs, selects, dialogs, drawers, toasts, skeletons, empty/error/confirm states. Must feel premium — not a generic admin dashboard.

### 21.2 Visual direction

Elegant, premium, modern, festive, warm, editorial, highly visual. Rich typography (elegant serif + clean sans by event/template). Avoid excessive gradients, generic SaaS look, huge empty space, over-rounded cards, childish animations, excessive glassmorphism, and poor typography.

### 21.3 Editor & preview layout

- **Desktop:** left = editor/form, right = live preview.
- **Mobile:** preview on top; sticky bottom action bar (Back · Preview · Save · Download · Publish · Share).
- Instant preview; guided flow; sensible defaults; preview never empty. Require signup only when persistence, publish, or share needs an account.

### 21.4 Accessibility (WCAG 2.1 AA)

Keyboard navigation, semantic HTML, labeled forms, focus management, contrast ≥ 4.5:1, `prefers-reduced-motion`, screen-reader-friendly controls, alt text. Web invitation must expose equivalent text content for visual designs and share messages.

### 21.5 Error handling

No bare “Something went wrong.” Use actionable copy (e.g. save failed with retry guidance; partial WhatsApp send failures with counts).

---

## 22. Internationalization, locale & timezone

- **FR-22.1** No hardcoded UI strings; all via `i18n/messages`. Target locales (progressive): English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali.
- **FR-22.2** Store structured date, time, timezone; format per locale.
- **FR-22.3** Validate fonts render target scripts in both web and export pipelines before committing launch locales that need those scripts.

---

## 23. Testing & quality gates

### 23.1 Tests

- **Unit:** template field mapping, date formatting, QR, slug generation, validation, export config, phone normalization.
- **Component:** template selector, event form, RSVP, media upload, preview, WhatsApp send preview/status.
- **E2E (Playwright):** create wedding invite → template → form → photo → Maps URL → QR → preview → PNG → PDF → publish → open public URL → RSVP → dashboard; plus Cloud API send path (or mocked provider with contract tests). Cover invalid data, long names/venues, missing images, mobile, slow network, failed uploads/exports/sends.

### 23.2 Quality gates

TypeScript compile, ESLint, formatter, unit, component, E2E, and production build must all be green. No unused vars, dead core TODOs, fake integrations presented as complete, hardcoded secrets, or broken routes.

---

## 24. Demo & Connected modes · environment

- **FR-24.1 Demo Mode:** template selection, forms, real preview, real PNG/PDF/QR, sample RSVP/events — for local/dev. Clearly labeled.
- **FR-24.2 Connected Mode:** Supabase auth, persistence, storage, RSVP, and WhatsApp Cloud API. Product default for real use.
- **FR-24.3** `.env.example` frontend placeholders only:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_MESSAGING_MODE=demo|cloud|wa_me
```

Backend secrets must not use `VITE_`: WhatsApp tokens/IDs, webhook secrets, service role key (Edge Functions only).

- **FR-24.4** Never fabricate delivery or persistence. Missing credentials → real interface + setup docs + safe demo adapter, marked “requires configuration.”

---

## 25. Deployment

- **FR-25.1** GitHub Actions: install → lint → test → build → deploy to dedicated host.
- **FR-25.2** Custom domain + HTTPS for production.
- **FR-25.3** SPA/hybrid deep-link rewrites so `/invite/<slug>` works on refresh.
- **FR-25.4** Server/edge path for OG/share meta.

---

## 26. Documentation

- **README:** overview, architecture, folder structure, local setup, env vars, Supabase setup, WhatsApp Business Cloud API config, dedicated hosting deploy, template-creation guide, adding event/card types, export formats, testing, troubleshooting.
- **`docs/`:** architecture, template engine, event model, export system, RSVP, WhatsApp integration, deployment, adding a template, testing.
- Highest-leverage doc: adding a template — write it early so template creation scales.

---

## 27. AI extension points (V2+)

Leave a clean `AIProvider` seam (not a core dependency) for wording, welcome suggestions, translation, template suggestion, theme/description, content resizing, RSVP summarization, thank-you generation. The editor must work fully without AI.

---

## 28. Build order

Phasing is implementation sequence only. Later slices remain part of the quality product.

### Slice A — Foundation

1. Scaffold React + Vite + TS + Tailwind + shadcn; CI; deploy to dedicated host.
2. Marketing/landing + docs skeleton.
3. Template schema + registry + canonical SVG renderer; dynamic Zod forms; initial wedding templates.
4. Live preview (two-pane / mobile sticky bar); structured date; welcome dropdown; venue.
5. Export engine (PNG @2×/3×, vector PDF) + QR.

### Slice B — Product core

6. Remaining event types + templates to hit §29 targets; card creator.
7. Supabase schema + RLS; magic-link auth; Persistence/Storage adapters; autosave; dashboards; duplicate event.
8. Publish invitation website (slugs + deep links + OG via edge/server); RSVP + RSVP admin (CSV); image upload to Storage.
9. WhatsApp Business Cloud API (Edge Function, templates, media, bulk + opt-in, webhooks, status UI) + `wa.me` fallback + Demo adapter.
10. Mobile polish; accessibility pass; analytics + error tracking; docs.

### Slice C — Depth (V1.1 / V2)

Guest wall; photo wall; music; video; multi-event weddings; privacy modes; personalized guest URLs; richer analytics; custom domain polish; template admin; marketplace; AI seams; payments/premium templates; extra messaging providers; authorized Canva integration.

---

## 29. Initial template targets

Wedding ×3 · Engagement ×2 · Birthday ×3 · Gruha Pravesham ×2 · Sangeet ×2 · Haldi ×2 · Marriage Bio ×2 · Dating Bio ×1 · Conference/Seminar Bio ×2.

All original or properly licensed, with full metadata and license info. Each must be a real composition.

---

## 30. Deliverables checklist

Working React app · responsive premium UI · template engine · initial templates · card creator · event editor · live preview · QR · PNG export · PDF export · live invitation website with OG/share previews · RSVP + dashboard · media upload · WhatsApp Business Cloud API (+ `wa.me` fallback + Demo) · Supabase Connected Mode · Demo Mode for local/dev · deploy to dedicated hosting · CI · tests · documentation.

---

## 31. Development reporting

After each major implementation phase, report: **Completed · Files Changed · Architecture · Verification · Next.** Keep code comments short and focused on why.

---

## 32. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SVG font embedding / export fidelity | Wrong fonts in PNG/PDF | Inline/embed fonts; test export early with long names and scripts |
| Regional scripts in canvas/PDF | Broken glyphs | Validate script rendering before launch locales need them |
| WhatsApp Business API approval & templates | Blocked media/bulk sends | Start Meta Business verification early; keep `wa.me` as temporary personal fallback only |
| Webhook / delivery tracking | Unclear send status | Schema + Edge Function webhooks in Slice B; contract tests for status mapping |
| Template copyright | Legal exposure | Original/licensed only; mandatory license metadata |
| Scope sprawl during Slice A | Delayed core path | Follow build order; do not skip export fidelity, RLS, or Cloud API |

---

## 33. Summary

Build a premium, mobile-first React + TypeScript + Vite platform on dedicated hosting with Supabase as the backend and WhatsApp Business Cloud API as the primary invitation distribution path. A canonical rendering model — `EventData + TemplateDefinition + Theme` — drives preview, PNG, vector PDF, and the interactive web invitation so exports match the design. Creators get wizarded invitations and bio cards, live guest sites, RSVP dashboards, and media-capable WhatsApp campaigns with delivery status. Guests open a link and RSVP with no account. Demo adapters support local development; Connected Mode is the product default. Templates are original or properly licensed and data-driven so new types and designs stay additive.
