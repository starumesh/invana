import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatEventDate, formatEventTime, type EventSummary } from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { ErrorBanner, LoadingBlock, PageTitle, SignInRequired, StatusBadge } from "@/components/events/ui";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

export function EventsListPage() {
  const { ready, signedIn } = useAuthSession();
  const [rows, setRows] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await eventsApi.list());
    } catch (err) {
      setError(errorMessage(err, "Unable to load your events. Please try again."));
      setRows((r) => r ?? []);
    }
  }, []);

  useEffect(() => {
    if (ready && signedIn) void load();
  }, [ready, signedIn, load]);

  if (!ready) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock /></main>;
  if (!signedIn) return <SignInRequired />;

  const upcoming = (rows ?? []).filter((r) => r.event.status !== "CANCELLED" && r.event.status !== "COMPLETED");
  const past = (rows ?? []).filter((r) => r.event.status === "CANCELLED" || r.event.status === "COMPLETED");

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <PageTitle eyebrow="Event management" title="Events">
        <Link to="/events/create" className={buttonClassName("gold")}>
          Create event
        </Link>
      </PageTitle>
      <p className="mt-2 max-w-2xl text-ink-muted">Guest lists, digital passes, door check-in, and live attendance for your events.</p>

      <div className="mt-6">
        <ErrorBanner message={error} onRetry={() => void load()} />
      </div>

      {rows === null ? <div className="mt-8"><LoadingBlock label="Loading events…" /></div> : null}

      {rows && !rows.length && !error ? (
        <div className="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <h2 className="font-serif text-2xl">No events yet</h2>
          <p className="mt-2 text-ink-muted">Create an event, add guests, and every guest gets a secure QR pass.</p>
          <Link to="/events/create" className={buttonClassName("gold", "md", "mt-6")}>
            Create your first event
          </Link>
        </div>
      ) : null}

      {upcoming.length ? <EventGrid title="Upcoming & drafts" rows={upcoming} /> : null}
      {past.length ? <EventGrid title="Past & cancelled" rows={past} /> : null}
    </main>
  );
}

function EventGrid({ title, rows }: { title: string; rows: EventSummary[] }) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">{title}</h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {rows.map(({ event, stats, access }) => (
          <li key={event.id} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-serif text-2xl">
                  <Link to={access === "STAFF" ? `/events/${event.id}/check-in` : `/events/${event.id}/manage`} className="hover:text-gold-dark focus:outline-none focus-visible:underline">
                    {event.name}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {formatEventDate(event.startDatetime, event.timezone)} · {formatEventTime(event.startDatetime, event.timezone)} · {event.venueName}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={event.status} />
                {access === "STAFF" ? <span className="text-xs text-ink-muted">Staff access</span> : null}
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-cream px-2 py-2">
                <dt className="text-xs text-ink-muted">Guests</dt>
                <dd className="font-semibold tabular-nums">{stats.invited}</dd>
              </div>
              <div className="rounded-xl bg-cream px-2 py-2">
                <dt className="text-xs text-ink-muted">Checked in</dt>
                <dd className="font-semibold tabular-nums">{stats.checkedIn}</dd>
              </div>
              <div className="rounded-xl bg-cream px-2 py-2">
                <dt className="text-xs text-ink-muted">Capacity</dt>
                <dd className="font-semibold tabular-nums">{stats.maxCapacity}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {access === "ORGANIZER" ? (
                <>
                  <Link to={`/events/${event.id}/manage`} className={buttonClassName("primary", "sm")}>
                    Manage
                  </Link>
                  <Link to={`/events/${event.id}/guests`} className={buttonClassName("secondary", "sm")}>
                    Guests
                  </Link>
                  <Link to={`/events/${event.id}/attendance`} className={buttonClassName("secondary", "sm")}>
                    Attendance
                  </Link>
                </>
              ) : null}
              <Link to={`/events/${event.id}/check-in`} className={buttonClassName(access === "STAFF" ? "gold" : "secondary", "sm")}>
                Check-in
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
