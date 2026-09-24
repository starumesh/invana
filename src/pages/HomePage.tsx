import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { TemplateThumb } from "@/components/templates/TemplateThumb";
import { getEventType } from "@/config/event-types";
import { trackTemplateClick } from "@/lib/analytics";
import { getTemplate, templatesForCard, templatesForEvent } from "@/templates/registry";
import type { CardTypeId, EventTypeId, TemplateDefinition } from "@/types";

const HERO = ["ivory-lotus-quiet", "nakshatra-night", "botanical-wild"] as const;

const SAMPLE_OCCASIONS: EventTypeId[] = [
  "wedding",
  "engagement",
  "birthday",
  "sangeet",
  "haldi",
  "reception",
  "party",
  "save-the-date",
];

type SampleItem = {
  key: string;
  template: TemplateDefinition;
  label: string;
  href: string;
  eventType?: EventTypeId;
  cardType?: CardTypeId;
};

function buildSampleRoom(): SampleItem[] {
  const used = new Set<string>();
  const samples: SampleItem[] = [];

  for (const id of SAMPLE_OCCASIONS) {
    const event = getEventType(id);
    const candidates = templatesForEvent(id);
    const pick =
      candidates.find((t) => !used.has(t.id) && t.eventTypes[0] === id) ??
      candidates.find((t) => !used.has(t.id)) ??
      candidates[0];
    if (!pick) continue;
    used.add(pick.id);
    samples.push({
      key: id,
      template: pick,
      label: event.name,
      eventType: id,
      href: `/create/${id}?template=${pick.id}`,
    });
  }

  const bioTemplates = templatesForCard("bio");
  const bio =
    bioTemplates.find((t) => !used.has(t.id) && t.id.includes("classic")) ??
    bioTemplates.find((t) => !used.has(t.id)) ??
    bioTemplates[0];
  if (bio) {
    samples.push({
      key: "bio",
      template: bio,
      label: "Bio Data",
      cardType: "bio",
      href: `/create/card?template=${bio.id}&card=bio`,
    });
  }

  return samples;
}

const SAMPLES = buildSampleRoom();

const REVIEWS = [
  {
    quote: "Wedding invite out the same evening. Relatives RSVP’d on WhatsApp with no follow-up calls.",
    name: "Ananya & Vikram",
    detail: "Wedding · Hyderabad",
    initials: "AV",
  },
  {
    quote: "Clean biodata for matrimony — not a resume. Templates felt personal; download was easy.",
    name: "Meera S.",
    detail: "Bio Data · Bengaluru",
    initials: "MS",
  },
  {
    quote: "Haldi and sangeet cards matched our colours. Guests said it looked printed.",
    name: "Rohan K.",
    detail: "Haldi & Sangeet · Pune",
    initials: "RK",
  },
] as const;

const FREE_POINTS = [
  { title: "Every template", body: "Invites & Bio Data" },
  { title: "Live preview", body: "As you type" },
  { title: "Guest RSVP", body: "One link" },
  { title: "WhatsApp", body: "Share ready" },
] as const;

function Stars() {
  return (
    <div className="flex gap-0.5 text-gold-dark" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-3 w-3 fill-current">
          <path d="M10 1.5 12.4 7l6 .5-4.6 4 1.4 5.8L10 14.8 4.8 17.3l1.4-5.8L1.6 7.5l6-.5L10 1.5Z" />
        </svg>
      ))}
    </div>
  );
}

export function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-stone-200/80">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 12% 18%, #e4c9a0 0%, transparent 52%), radial-gradient(ellipse 55% 45% at 92% 8%, #edd9c0 0%, transparent 48%), linear-gradient(160deg, #faf7f2 0%, #f4ebe1 46%, #ebe0d0 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='72' height='72' viewBox='0 0 72 72' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23b8956a' fill-opacity='0.09'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-11 md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:py-14 lg:gap-14">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-white/55 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-gold-dark backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-soft-pulse" aria-hidden />
              Free to create
            </p>
            <p className="mt-4 font-serif text-4xl tracking-tight text-ink md:text-5xl lg:text-[3.35rem]">
              Invana
            </p>
            <h1 className="mt-3 max-w-lg font-display text-[1.65rem] leading-[1.2] text-ink md:text-3xl">
              Invitations &amp; bio cards that feel like keepsakes.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted md:text-base">
              Pick a mood, personalize in minutes, download or share on WhatsApp — no paid plan to open the editor.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/create">
                <Button variant="gold" className="shadow-soft">
                  Create invitation
                </Button>
              </Link>
              <Link to="/create/card">
                <Button variant="secondary">Create Bio Data</Button>
              </Link>
            </div>
            <ol className="mt-6 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              {["Choose", "Personalize", "Share"].map((step, i) => (
                <li
                  key={step}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-200/80 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm"
                >
                  <span className="font-medium text-gold-dark">0{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="relative mx-auto h-[19rem] w-full max-w-sm md:mx-0 md:h-[22rem] md:max-w-none">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(circle, #d4b48a66 0%, transparent 70%)" }}
              aria-hidden
            />
            {HERO.map((id, index) => {
              const template = getTemplate(id)!;
              const offsets = [
                "left-0 top-7 z-10 rotate-[-7deg]",
                "left-1/2 top-0 z-20 -translate-x-1/2",
                "right-0 top-9 z-[5] rotate-[8deg]",
              ];
              return (
                <div
                  key={id}
                  className={`absolute w-[47%] animate-fade-up ${offsets[index]}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div
                    className={`shadow-lift transition duration-500 hover:z-30 hover:scale-[1.03] ${index === 1 ? "animate-float" : ""}`}
                  >
                    <TemplateThumb
                      template={template}
                      eventType={template.eventTypes[0]}
                      className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-card ring-1 ring-black/[0.03]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-stone-200/80 bg-ink text-cream">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 45% 120% at 0% 50%, #b8956a40 0%, transparent 55%), radial-gradient(ellipse 35% 90% at 100% 20%, #8c6d4530 0%, transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-8 md:py-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="max-w-md animate-fade-up">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold">Why hosts start here</p>
              <p className="mt-2 font-serif text-2xl leading-snug md:text-[1.75rem]">
                Free to begin — every template, no subscription.
              </p>
            </div>
            <ul className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              {FREE_POINTS.map((item, index) => (
                <li
                  key={item.title}
                  className="animate-fade-up rounded-xl border border-cream/10 bg-cream/[0.05] px-3 py-3 backdrop-blur-sm transition hover:border-gold/35 hover:bg-cream/[0.08]"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <p className="text-sm font-medium text-cream">{item.title}</p>
                  <p className="mt-0.5 text-xs text-cream/60">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <h2 className="font-serif text-2xl md:text-[1.75rem]">Digital invitations online</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted md:text-base">
              Design a free online invitation for weddings, birthdays, engagements, and festive events. Choose a
              template, personalize names and venue, then download your invitation card or publish an RSVP page to
              share on WhatsApp.
            </p>
            <Link to="/create" className="mt-3 inline-block text-sm font-medium text-gold-dark underline-offset-4 hover:underline">
              Create an invitation →
            </Link>
          </div>
          <div>
            <h2 className="font-serif text-2xl md:text-[1.75rem]">Marriage bio data &amp; biodata</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted md:text-base">
              Build a classic bio data / biodata sheet for matrimony — personal, family, and contact details in a
              clean format. Download PNG or PDF when you are ready to share.
            </p>
            <Link
              to="/create/card"
              className="mt-3 inline-block text-sm font-medium text-gold-dark underline-offset-4 hover:underline"
            >
              Create bio data →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold-dark">Gallery</p>
            <h2 className="mt-1 font-serif text-2xl md:text-3xl">A sample of the room</h2>
            <p className="mt-1 text-sm text-ink-muted">One look per occasion — tap to start free.</p>
          </div>
          <Link
            to="/templates"
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-sm text-ink transition hover:border-gold/40 hover:text-gold-dark"
          >
            Browse all
            <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {SAMPLES.map((sample, index) => (
            <Link
              key={sample.key}
              to={sample.href}
              className="group block animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              onClick={() =>
                trackTemplateClick({
                  templateId: sample.template.id,
                  templateName: sample.template.name,
                  kind: sample.template.kind,
                  source: "home",
                  eventType: sample.eventType,
                  cardType: sample.cardType,
                })
              }
            >
              <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:border-gold/35 group-hover:shadow-lift">
                <TemplateThumb
                  template={sample.template}
                  eventType={sample.eventType}
                  cardType={sample.cardType}
                  className="overflow-hidden rounded-none border-0 shadow-none"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent px-2.5 pb-2.5 pt-10 opacity-0 transition duration-300 group-hover:opacity-100">
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-cream">Start free</span>
                </div>
              </div>
              <div className="mt-2.5 min-w-0">
                <p className="truncate text-sm font-medium text-ink group-hover:text-gold-dark">{sample.label}</p>
                <p className="truncate text-xs text-ink-muted">{sample.template.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-stone-200/80">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(180deg, #f6efe6 0%, #faf7f2 45%, #f3ebe0 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold-dark">Reviews</p>
              <h2 className="mt-1 font-serif text-2xl md:text-3xl">Hosts who shipped the same day</h2>
            </div>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3 md:gap-5">
            {REVIEWS.map((review, index) => (
              <figure
                key={review.name}
                className="animate-fade-up flex flex-col rounded-2xl border border-stone-200/90 bg-white/90 p-5 shadow-card backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lift md:p-6"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <Stars />
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[11px] font-medium tracking-wide text-cream">
                    {review.initials}
                  </span>
                </div>
                <blockquote className="mt-4 flex-1 font-serif text-[1.05rem] leading-snug text-ink md:text-lg">
                  “{review.quote}”
                </blockquote>
                <figcaption className="mt-5 border-t border-stone-100 pt-3">
                  <p className="text-sm font-medium text-ink">{review.name}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-ink-muted">{review.detail}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-14">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-ink px-6 py-9 text-cream md:px-10 md:py-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 55% 80% at 85% 20%, #b8956a55 0%, transparent 50%), radial-gradient(ellipse 40% 60% at 10% 90%, #8c6d4533 0%, transparent 45%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px animate-sheen"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(212,175,105,0.55), transparent)",
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="animate-fade-up">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold">Free to start</p>
              <p className="mt-2 font-serif text-2xl md:text-3xl">Ready when you are</p>
              <p className="mt-1.5 max-w-md text-sm text-cream/65">
                Open a template, make it yours, share when it feels right.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 animate-fade-up" style={{ animationDelay: "80ms" }}>
              <Link to="/create">
                <Button variant="gold">Create invitation</Button>
              </Link>
              <Link to="/create/card">
                <Button
                  variant="secondary"
                  className="border-cream/30 bg-transparent text-cream hover:border-cream/50 hover:bg-white/5"
                >
                  Create Bio Data
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
