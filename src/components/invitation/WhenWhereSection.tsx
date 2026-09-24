type Props = {
  date?: string;
  time?: string;
  venue?: string;
  address?: string;
  mapsUrl?: string;
};

export function WhenWhereSection({ date, time, venue, address, mapsUrl }: Props) {
  const hasWhen = Boolean(date);
  const hasWhere = Boolean(venue || address);
  if (!hasWhen && !hasWhere) return null;

  return (
    <section className="animate-fade-up">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">Gather</p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">When &amp; where</h2>
        <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden />
      </div>

      <div
        className={`mt-8 grid gap-4 ${hasWhen && hasWhere ? "sm:grid-cols-2" : "mx-auto max-w-md"}`}
      >
        {hasWhen ? (
          <article className="rounded-2xl border border-stone-200/70 bg-white/90 px-6 py-7 text-center shadow-soft backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">When</p>
            <p className="mt-3 font-serif text-xl leading-snug text-ink md:text-2xl">{date}</p>
            {time ? <p className="mt-2 text-sm text-ink-muted">{time}</p> : null}
          </article>
        ) : null}

        {hasWhere ? (
          <article className="rounded-2xl border border-stone-200/70 bg-white/90 px-6 py-7 text-center shadow-soft backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Where</p>
            {venue ? <p className="mt-3 font-serif text-xl leading-snug text-ink md:text-2xl">{venue}</p> : null}
            {address ? <p className="mt-2 text-sm leading-relaxed text-ink-muted">{address}</p> : null}
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-xs uppercase tracking-[0.14em] text-gold-dark underline-offset-4 transition hover:underline"
              >
                Open map
              </a>
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}
