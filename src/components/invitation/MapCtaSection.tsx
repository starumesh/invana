type Props = {
  venueName?: string;
  address?: string;
  mapsUrl: string;
};

export function MapCtaSection({ venueName, address, mapsUrl }: Props) {
  return (
    <section className="animate-fade-up relative overflow-hidden rounded-2xl border border-stone-200/70 bg-ink px-6 py-8 text-cream shadow-lift sm:px-8 sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 90% 10%, #b8956a66 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 0% 100%, #8c6d4544 0%, transparent 50%)",
        }}
        aria-hidden
      />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-light">Find us</p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight text-cream">Venue &amp; directions</h2>
        {venueName ? <p className="mt-4 font-serif text-xl text-cream/95">{venueName}</p> : null}
        {address ? <p className="mt-2 max-w-md text-sm leading-relaxed text-cream/65">{address}</p> : null}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-6 text-sm font-medium text-ink shadow-soft transition hover:bg-gold-light"
        >
          Open in Google Maps
        </a>
      </div>
    </section>
  );
}
