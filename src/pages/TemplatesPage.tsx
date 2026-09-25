import { useMemo, useState } from "react";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { Select } from "@/components/ui/Field";
import { EVENT_TYPES } from "@/config/event-types";
import { CARD_TYPES } from "@/config/card-types";
import { trackTemplateClick } from "@/lib/analytics";
import { TEMPLATES } from "@/templates/registry";
import type { CardTypeId, EventTypeId } from "@/types";

export function TemplatesPage() {
  const [kind, setKind] = useState<"all" | "invitation" | "card">("all");
  const [eventType, setEventType] = useState<EventTypeId | "all">("all");
  const [cardType, setCardType] = useState<CardTypeId | "all">("all");

  const filtered = useMemo(() => {
    return TEMPLATES.filter((template) => {
      if (kind !== "all" && template.kind !== kind) return false;
      if (eventType !== "all" && template.kind === "invitation" && !template.eventTypes.includes(eventType)) {
        return false;
      }
      if (cardType !== "all" && template.kind === "card" && !template.cardTypes?.includes(cardType)) {
        return false;
      }
      return true;
    });
  }, [kind, eventType, cardType]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:py-14">
      <div className="max-w-2xl animate-fade-up">
        <p className="text-xs uppercase tracking-[0.18em] text-gold-dark">Gallery</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">Template gallery</h1>
        <p className="mt-3 text-ink-muted">Browse by look — tap Use on any card to start personalizing.</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["invitation", "Invitations"],
            ["card", "Cards"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={
              kind === value
                ? "rounded-full bg-ink px-4 py-2 text-sm text-cream"
                : "rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-ink-muted hover:text-ink"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {kind !== "card" ? (
        <div className="mt-6 max-w-sm">
          <label htmlFor="gallery-occasion" className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
            Occasion
          </label>
          <Select
            id="gallery-occasion"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventTypeId | "all")}
          >
            <option value="all">All occasions</option>
            {EVENT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="mt-6 max-w-sm">
          <label htmlFor="gallery-card-type" className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
            Card type
          </label>
          <Select
            id="gallery-card-type"
            value={cardType}
            onChange={(e) => setCardType(e.target.value as CardTypeId | "all")}
          >
            <option value="all">All card types</option>
            {CARD_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template, index) => {
          const href =
            template.kind === "card"
              ? `/create/card?template=${template.id}&card=${template.cardTypes?.[0] ?? CARD_TYPES[0].id}`
              : `/create/${template.eventTypes[0]}?template=${template.id}`;
          return (
            <TemplateCard
              key={template.id}
              template={template}
              eventType={template.eventTypes[0]}
              cardType={template.cardTypes?.[0]}
              href={href}
              ctaLabel="Use"
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 9) * 35}ms` }}
              meta={
                template.kind === "card"
                  ? template.cardTypes?.includes("bio")
                    ? "Bio Data"
                    : "Card"
                  : template.eventTypes.slice(0, 2).join(" · ")
              }
              onNavigate={() =>
                trackTemplateClick({
                  templateId: template.id,
                  templateName: template.name,
                  kind: template.kind,
                  source: "gallery",
                  eventType: template.kind === "invitation" ? template.eventTypes[0] : undefined,
                  cardType: template.kind === "card" ? template.cardTypes?.[0] : undefined,
                })
              }
            />
          );
        })}
      </div>

      {!filtered.length ? (
        <div className="mt-12 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-14 text-center">
          <h2 className="font-serif text-2xl">Nothing matches</h2>
          <p className="mt-2 text-ink-muted">Clear a filter to see more compositions.</p>
        </div>
      ) : null}
    </main>
  );
}
