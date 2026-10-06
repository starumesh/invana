import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { EventOverview } from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { PASS_TABS } from "@/components/events/guestTableConfig";
import { GuestTable } from "@/components/events/GuestTable";
import { ErrorBanner, EventSubNav, LoadingBlock, Notice, PageTitle, SignInRequired, StatCard } from "@/components/events/ui";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

/** View Passes: table-based management for large audiences (server-side search/sort/pages). */
export function EventPassesPage() {
  const { eventId = "" } = useParams();
  const { ready, signedIn } = useAuthSession();
  const [overview, setOverview] = useState<EventOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await eventsApi.overview(eventId));
    } catch (err) {
      setError(errorMessage(err, "Unable to load passes. Please try again."));
    }
  }, [eventId]);

  useEffect(() => {
    if (ready && signedIn) void load();
  }, [ready, signedIn, load]);

  if (ready && !signedIn) return <SignInRequired />;
  if (!overview) {
    return <main className="mx-auto max-w-6xl px-4 py-12">{error ? <ErrorBanner message={error} onRetry={() => void load()} /> : <LoadingBlock label="Loading passes…" />}</main>;
  }

  const { event, stats } = overview;
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to={`/events/${event.id}/manage`} className="text-sm text-ink-muted hover:text-ink">
        ← {event.name}
      </Link>
      <div className="mt-3">
        <PageTitle eyebrow="View passes" title={`${stats.passesIssued} of ${stats.invited} passes generated`} />
      </div>
      <EventSubNav eventId={event.id} />

      <section aria-label="Pass summary" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Not generated" value={stats.passesPending} />
        <StatCard label="Generated" value={stats.passesIssued} />
        <StatCard label="Shared" value={stats.passesShared} />
        <StatCard label="Checked in" value={stats.checkedIn} tone="green" />
      </section>

      <div className="mt-6 space-y-3">
        {event.status === "DRAFT" ? <Notice tone="warn">Passes can be shared now, but check-in only works after you publish the event.</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        <ErrorBanner message={error} />
      </div>

      <div className="mt-6">
        <GuestTable
          eventId={event.id}
          event={event}
          timezone={event.timezone}
          exportName={event.publicId}
          editable={editable}
          mode="passes"
          tabs={PASS_TABS}
          onNotice={setNotice}
          onError={setError}
          onCountsChanged={load}
        />
      </div>
    </main>
  );
}
