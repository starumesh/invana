import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TemplateThumb } from "@/components/templates/TemplateThumb";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { CARD_TYPES, normalizeCardType } from "@/config/card-types";
import { EVENT_TYPES, getEventType } from "@/config/event-types";
import { createDraft } from "@/lib/drafts";
import { templatesForCard, templatesForEvent } from "@/templates/registry";
import type { CardTypeId, EventTypeId } from "@/types";

const VALID_EVENTS = new Set(EVENT_TYPES.map((t) => t.id));

type Tab = "invitations" | "cards";

function CreateTabs({ tab }: { tab: Tab }) {
  return (
    <div className="mt-8 inline-flex rounded-full border border-stone-200 bg-white p-1">
      <Link
        to="/create"
        className={
          tab === "invitations"
            ? "rounded-full bg-ink px-5 py-2 text-sm text-cream"
            : "rounded-full px-5 py-2 text-sm text-ink-muted transition hover:text-ink"
        }
      >
        Invitations
      </Link>
      <Link
        to="/create/card"
        className={
          tab === "cards"
            ? "rounded-full bg-ink px-5 py-2 text-sm text-cream"
            : "rounded-full px-5 py-2 text-sm text-ink-muted transition hover:text-ink"
        }
      >
        Cards
      </Link>
    </div>
  );
}

function InvitationCreate({ eventType }: { eventType: EventTypeId }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const preferred = params.get("template");
  const templates = templatesForEvent(eventType);

  const ordered = useMemo(() => {
    if (!preferred) return templates;
    return [...templates.filter((t) => t.id === preferred), ...templates.filter((t) => t.id !== preferred)];
  }, [templates, preferred]);

  async function start(templateId: string) {
    setBusy(true);
    try {
      const draft = await createDraft({ templateId, eventType });
      navigate(`/builder/${draft.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-8 max-w-sm">
        <label htmlFor="event-type" className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
          Occasion
        </label>
        <Select
          id="event-type"
          value={eventType}
          onChange={(e) => navigate(`/create/${e.target.value}`)}
        >
          {EVENT_TYPES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((template, index) => (
          <div
            key={template.id}
            className="group space-y-3 animate-fade-up"
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            <TemplateThumb
              template={template}
              eventType={eventType}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{template.name}</p>
              <Button type="button" size="sm" disabled={busy} onClick={() => void start(template.id)}>
                Use
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!ordered.length ? (
        <div className="mt-12 rounded-3xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
          <h2 className="font-serif text-2xl">No templates yet</h2>
          <p className="mt-2 text-ink-muted">Try another occasion from the list above.</p>
        </div>
      ) : null}
    </>
  );
}

function CardCreate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Bio Data is the default Cards selection; legacy ?card=marriage-bio resolves to bio.
  const initial = normalizeCardType(params.get("card")) ?? CARD_TYPES[0].id;
  const [cardType, setCardType] = useState<CardTypeId>(initial);
  const [busy, setBusy] = useState(false);
  const preferred = params.get("template");
  const templates = templatesForCard(cardType);

  const ordered = useMemo(() => {
    if (!preferred) return templates;
    return [...templates.filter((t) => t.id === preferred), ...templates.filter((t) => t.id !== preferred)];
  }, [templates, preferred]);

  async function start(templateId: string) {
    setBusy(true);
    try {
      const draft = await createDraft({ templateId, cardType });
      navigate(`/builder/${draft.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-8 max-w-sm">
        <label htmlFor="card-type" className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
          Card type
        </label>
        <Select
          id="card-type"
          value={cardType}
          onChange={(e) => setCardType(e.target.value as CardTypeId)}
        >
          {CARD_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((template, index) => (
          <div
            key={template.id}
            className="group space-y-3 animate-fade-up"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <TemplateThumb
              template={template}
              cardType={cardType}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{template.name}</p>
              <Button type="button" size="sm" disabled={busy} onClick={() => void start(template.id)}>
                Use
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!ordered.length ? (
        <div className="mt-12 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-14 text-center">
          <h2 className="font-serif text-2xl">No templates for this type</h2>
          <p className="mt-2 text-ink-muted">Try another card type from the list above.</p>
          <Button type="button" className="mt-6" variant="secondary" onClick={() => setCardType("custom-card")}>
            Custom Profile Card
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** Create flow entry — invitations (silent wedding default) or cards. */
export function CreatePage() {
  const location = useLocation();
  const { eventType: rawType } = useParams();
  const isCard = location.pathname === "/create/card" || location.pathname.endsWith("/create/card");

  if (!isCard && rawType && !(VALID_EVENTS as Set<string>).has(rawType)) {
    return <Navigate to="/create" replace />;
  }

  const tab: Tab = isCard ? "cards" : "invitations";
  const eventType = (rawType && (VALID_EVENTS as Set<string>).has(rawType) ? rawType : "wedding") as EventTypeId;
  const meta = getEventType(eventType);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <div className="max-w-2xl animate-fade-up">
        <p className="text-xs uppercase tracking-[0.18em] text-gold-dark">Create</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">
          {tab === "cards" ? "Choose a Bio Data or card" : "Choose a digital invitation"}
        </h1>
        <p className="mt-3 text-ink-muted">
          {tab === "cards"
            ? "Classic marriage biodata sheets, speaker folios, and profile cards — pick a look that feels like them."
            : `Pick an online invitation card that feels right for your ${meta.name.toLowerCase()}.`}
        </p>
      </div>

      <CreateTabs tab={tab} />

      {tab === "cards" ? <CardCreate /> : <InvitationCreate eventType={eventType} />}
    </main>
  );
}
