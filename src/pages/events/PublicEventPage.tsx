import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatDuration, formatEventDate, formatEventTime, GUEST_ROLE_LABELS, type PublicEventView } from "@event-core";
import { CalendarActions, ShareActions } from "@/components/events/ShareActions";
import { LocationMap } from "@/components/events/LocationMap";
import { ErrorBanner, LoadingBlock } from "@/components/events/ui";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { eventWhatsAppText, publicEventUrl } from "@/lib/eventShare";
import { openInMapsUrl } from "@/lib/maps";
import { usePageMeta } from "@/seo/usePageMeta";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

export function PublicEventPage() {
  const { slug = "" } = useParams();
  const [event, setEvent] = useState<PublicEventView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void eventsApi
      .publicEvent(slug)
      .then((e) => !cancelled && setEvent(e))
      .catch((err) => !cancelled && setError(errorMessage(err, "This event could not be loaded. Please try again.")));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  usePageMeta({
    title: event ? `${event.name} · Invana` : "Event · Invana",
    description: event?.description.slice(0, 160),
  });

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <ErrorBanner message={error} />
        <Link to="/" className="mt-6 inline-block text-sm underline">
          Go to Invana
        </Link>
      </main>
    );
  }
  if (!event) return <main className="mx-auto max-w-2xl px-4 py-16"><LoadingBlock label="Loading event…" /></main>;

  const url = publicEventUrl(event.slug);
  const point = { lat: event.latitude, lng: event.longitude };
  const fullAddress = [event.address, event.city, event.state, event.country].filter(Boolean).join(", ");
  const cancelled = event.status === "CANCELLED";

  return (
    <main className="min-h-screen bg-cream pb-16">
      <header className="bg-ink px-4 pb-12 pt-10 text-cream">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.24em] text-gold-light">{event.eventType}</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{event.name}</h1>
          {cancelled ? (
            <p className="mt-4 inline-block rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold" role="status">
              This event has been cancelled
            </p>
          ) : null}
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-cream/60">Date</dt>
              <dd className="text-base font-medium">{formatEventDate(event.startDatetime, event.timezone)}</dd>
            </div>
            <div>
              <dt className="text-cream/60">Time</dt>
              <dd className="text-base font-medium">
                {formatEventTime(event.startDatetime, event.timezone)} · {formatDuration(event.durationMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-cream/60">Venue</dt>
              <dd className="text-base font-medium">{event.venueName}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mx-auto -mt-6 max-w-3xl space-y-6 px-4">
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm" aria-labelledby="about">
          <h2 id="about" className="font-serif text-2xl">
            About
          </h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-muted">{event.description}</p>
          <p className="mt-4 text-sm">
            Maximum capacity: <span className="font-semibold">{event.maxCapacity.toLocaleString()}</span> · {event.registeredCount.toLocaleString()} guests
            invited · Entry by personal pass only
          </p>
        </section>

        {!cancelled ? (
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm" aria-labelledby="share">
            <h2 id="share" className="font-serif text-2xl">
              Share & save the date
            </h2>
            <div className="mt-3">
              <ShareActions url={url} title={event.name} whatsAppText={eventWhatsAppText(event, url)} />
            </div>
            <CalendarActions
              filename={`${event.slug}.ics`}
              event={{
                title: event.name,
                description: event.description,
                location: [event.venueName, fullAddress].join(", "),
                startIso: event.startDatetime,
                durationMinutes: event.durationMinutes,
                url,
                uid: event.publicId,
              }}
            />
          </section>
        ) : null}

        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm" aria-labelledby="venue">
          <h2 id="venue" className="font-serif text-2xl">
            Venue
          </h2>
          <p className="mt-2">
            <span className="font-medium">{event.venueName}</span>
            <br />
            <span className="text-sm text-ink-muted">{fullAddress}</span>
          </p>
          <div className="mt-4">
            <LocationMap value={point} label={`Map of ${event.venueName}`} height={240} />
          </div>
          <a href={openInMapsUrl(point)} target="_blank" rel="noreferrer" className={buttonClassName("gold", "md", "mt-4")}>
            Open in Maps
          </a>
        </section>

        {event.timeline.length ? (
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm" aria-labelledby="schedule">
            <h2 id="schedule" className="font-serif text-2xl">
              Schedule
            </h2>
            <ol className="mt-4 space-y-4 border-l-2 border-gold/40 pl-5">
              {event.timeline.map((t) => (
                <li key={t.id}>
                  <p className="text-sm tabular-nums text-gold-dark">
                    {formatEventTime(t.startTime, event.timezone)} – {formatEventTime(t.endTime, event.timezone)}
                  </p>
                  <p className="font-medium">{t.title}</p>
                  {t.location ? <p className="text-sm text-ink-muted">{t.location}</p> : null}
                  {t.description ? <p className="text-sm text-ink-muted">{t.description}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {event.featuredGuests.length ? (
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm" aria-labelledby="people">
            <h2 id="people" className="font-serif text-2xl">
              Speakers & hosts
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {event.featuredGuests.map((g, i) => (
                <li key={`${g.name}-${i}`}>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs uppercase tracking-wider text-gold-dark">{GUEST_ROLE_LABELS[g.role]}</p>
                  {g.bio ? <p className="mt-1 text-sm text-ink-muted">{g.bio}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-center text-xs text-ink-muted">
          {event.publicId} · Made with <Link to="/" className="underline">Invana</Link>
        </p>
      </div>
    </main>
  );
}
