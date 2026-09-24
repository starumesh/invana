type Highlight = {
  label: string;
  value: string;
};

type Props = {
  items: Highlight[];
};

export function ScheduleHighlightsSection({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="animate-fade-up overflow-hidden rounded-2xl border border-stone-200/70 bg-white/90 shadow-soft backdrop-blur-sm">
      <div className="border-b border-stone-200/60 bg-cream-dark/40 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">The details</p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight">Schedule &amp; notes</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          A few things to know before you arrive.
        </p>
      </div>
      <ul className="divide-y divide-stone-200/70 px-6 sm:px-8">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex flex-col gap-1.5 py-5 sm:flex-row sm:items-baseline sm:gap-8"
          >
            <span className="shrink-0 font-display text-sm tracking-[0.12em] text-gold-dark sm:w-28">
              {item.label}
            </span>
            <span className="text-base leading-relaxed text-ink">{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
