import { TemplateThumb } from "@/components/templates/TemplateThumb";
import { cn } from "@/lib/cn";
import type { CardTypeId, EventTypeId, TemplateDefinition } from "@/types";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

const ctaClass =
  "inline-flex shrink-0 items-center justify-center rounded-full bg-ink px-3.5 py-2 text-sm font-medium tracking-tight text-cream transition duration-200 group-hover:bg-stone-800 group-focus-visible:bg-stone-800";

type Shared = {
  template: TemplateDefinition;
  eventType?: EventTypeId;
  cardType?: CardTypeId;
  title?: string;
  meta?: ReactNode;
  ctaLabel?: string;
  highlighted?: boolean;
  className?: string;
  style?: CSSProperties;
};

type ActionProps = Shared & {
  href?: never;
  busy?: boolean;
  onUse: () => void;
};

type LinkProps = Shared & {
  href: string;
  busy?: never;
  onUse?: never;
  onNavigate?: () => void;
};

export type TemplateCardProps = ActionProps | LinkProps;

function CardBody({
  template,
  eventType,
  cardType,
  title,
  meta,
  ctaLabel = "Use",
  busy,
}: {
  template: TemplateDefinition;
  eventType?: EventTypeId;
  cardType?: CardTypeId;
  title?: string;
  meta?: ReactNode;
  ctaLabel?: string;
  busy?: boolean;
}) {
  return (
    <>
      <TemplateThumb
        template={template}
        eventType={eventType}
        cardType={cardType}
        className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card transition duration-300 group-hover:-translate-y-0.5 group-hover:border-gold/35 group-hover:shadow-lift group-focus-visible:-translate-y-0.5 group-focus-visible:border-gold/35 group-focus-visible:shadow-lift"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium group-hover:text-gold-dark group-focus-visible:text-gold-dark">
            {title ?? template.name}
          </p>
          {meta ? <div className="mt-0.5 text-sm text-ink-muted">{meta}</div> : null}
        </div>
        <span className={cn(ctaClass, busy && "opacity-50")} aria-hidden>
          {busy ? "…" : ctaLabel}
        </span>
      </div>
    </>
  );
}

/**
 * Template preview with an always-visible Use CTA.
 * Whole card is the hit target (button or link) — no hover-only reveal.
 */
export function TemplateCard(props: TemplateCardProps) {
  const {
    template,
    eventType,
    cardType,
    title,
    meta,
    ctaLabel = "Use",
    highlighted,
    className,
    style,
  } = props;

  const shell = cn(
    "group block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
    highlighted && "rounded-xl ring-2 ring-gold ring-offset-2 ring-offset-cream",
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link
        to={props.href}
        className={shell}
        style={style}
        onClick={() => props.onNavigate?.()}
        aria-label={`${ctaLabel} ${title ?? template.name}`}
      >
        <CardBody
          template={template}
          eventType={eventType}
          cardType={cardType}
          title={title}
          meta={meta}
          ctaLabel={ctaLabel}
        />
      </Link>
    );
  }

  const { onUse, busy } = props as ActionProps;

  return (
    <button
      type="button"
      className={shell}
      style={style}
      disabled={busy}
      aria-label={`${ctaLabel} ${title ?? template.name}`}
      onClick={onUse}
    >
      <CardBody
        template={template}
        eventType={eventType}
        cardType={cardType}
        title={title}
        meta={meta}
        ctaLabel={ctaLabel}
        busy={busy}
      />
    </button>
  );
}
