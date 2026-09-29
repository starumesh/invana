import { memo, useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { formatEventDate, formatEventTime, type EventListRow } from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { ErrorBanner, Notice, PageTitle, SignInRequired, StatusBadge } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

const PAGE_SIZE = 24;
const CACHE_KEY = "invana.em.list.v1";

type Cached = { userId: string; rows: EventListRow[]; nextCursor: string | null; at: number };

function readCache(userId: string): Cached | null {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as Cached | null;
    return c && c.userId === userId ? c : null;
  } catch {
    return null;
  }
}

export function EventsListPage() {
  const { ready, signedIn, user } = useAuthSession();
  const location = useLocation();
  const userId = user?.id ?? "";
  const [rows, setRows] = useState<EventListRow[] | null>(() => (userId ? readCache(userId)?.rows ?? null : null));
  const [nextCursor, setNextCursor] = useState<string | null>(() => (userId ? readCache(userId)?.nextCursor ?? null : null));
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setRefreshing(true);
    try {
      const page = await eventsApi.list({ limit: PAGE_SIZE });
      setRows(page.events);
      setNextCursor(page.nextCursor);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ userId, rows: page.events, nextCursor: page.nextCursor, at: Date.now() } satisfies Cached));
    } catch (err) {
      setError(errorMessage(err, "Unable to load your invitations. Please try again."));
      setRows((r) => r ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!ready || !signedIn || !userId) return;
    const cached = readCache(userId);
    if (cached) {
      setRows(cached.rows);
      setNextCursor(cached.nextCursor);
    }
    void load();
  }, [ready, signedIn, userId, load]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await eventsApi.list({ limit: PAGE_SIZE, cursor: nextCursor });
      setRows((r) => [...(r ?? []), ...page.events.filter((e) => !(r ?? []).some((x) => x.event.id === e.event.id))]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(errorMessage(err, "Unable to load more invitations."));
    } finally {
      setLoadingMore(false);
    }
  }

  if (ready && !signedIn) return <SignInRequired />;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <PageTitle eyebrow="Guests, passes & check-in" title="My Invitations">
        <Link to="/events/create" className={buttonClassName("gold")}>
          Create invitation
        </Link>
      </PageTitle>
      <p className="mt-2 flex items-center gap-2 text-ink-muted">
        Guest lists, digital passes, door check-in, and live attendance.
        {refreshing && rows?.length ? <span className="text-xs text-ink-faint" aria-live="polite">Updating…</span> : null}
      </p>

      <div className="mt-6 space-y-3">
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        <ErrorBanner message={error} onRetry={() => void load()} />
      </div>

      {rows === null ? (
        <ul className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Loading invitations" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-44 animate-soft-pulse rounded-3xl border border-stone-200 bg-white" />
          ))}
        </ul>
      ) : null}

      {rows && !rows.length && !error ? (
        <div className="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <h2 className="font-serif text-2xl">No invitations yet</h2>
          <p className="mt-2 text-ink-muted">Create an invitation, add guests, and give each guest a secure QR pass.</p>
          <Link to="/events/create" className={buttonClassName("gold", "md", "mt-6")}>
            Create your first invitation
          </Link>
        </div>
      ) : null}

      {rows?.length ? (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <InvitationCard key={r.event.id} row={r} />
          ))}
        </ul>
      ) : null}

      {nextCursor ? (
        <div className="mt-8 text-center">
          <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </main>
  );
}

const InvitationCard = memo(function InvitationCard({ row: { event, stats, access } }: { row: EventListRow }) {
  const href = access === "STAFF" ? `/events/${event.id}/check-in` : `/events/${event.id}/manage`;
  return (
    <li className="relative rounded-3xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-gold/60 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-2xl">
            <Link to={href} className="after:absolute after:inset-0 after:rounded-3xl focus:outline-none focus-visible:underline">
              {event.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {formatEventDate(event.startDatetime, event.timezone)} · {formatEventTime(event.startDatetime, event.timezone)} · {event.venueName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={event.status} />
          {access === "STAFF" ? <span className="text-xs text-ink-muted">Staff access</span> : null}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
        {[
          ["Guests", stats.invited],
          ["Passes", stats.passesIssued],
          ["Checked in", stats.checkedIn],
          ["Capacity", stats.maxCapacity],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-cream px-2 py-2">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
});
