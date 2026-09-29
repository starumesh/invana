import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEventTime, GUEST_ROLE_LABELS, toCsv, type AttendanceFilter, type AttendanceView } from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { ErrorBanner, EventSubNav, LoadingBlock, PageTitle, SignInRequired, StatCard, StatusBadge } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { downloadFile } from "@/lib/download";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

const FILTERS: { id: AttendanceFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "CHECKED_IN", label: "Checked In" },
  { id: "NOT_CHECKED_IN", label: "Not Checked In" },
  { id: "CANCELLED", label: "Cancelled" },
];

const POLL_MS = 5000;

export function EventAttendancePage() {
  const { eventId } = useParams();
  const { ready, signedIn } = useAuthSession();
  const [view, setView] = useState<AttendanceView | null>(null);
  const [eventName, setEventName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [filter, setFilter] = useState<AttendanceFilter>("ALL");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setView(await eventsApi.attendance(eventId, filter, q.trim()));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Unable to load attendance. Retrying…"));
    }
  }, [eventId, filter, q]);

  useEffect(() => {
    if (!ready || !signedIn || !eventId) return;
    void eventsApi
      .get(eventId)
      .then((d) => {
        setEventName(d.event.name);
        setTimezone(d.event.timezone);
      })
      .catch(() => undefined);
  }, [ready, signedIn, eventId]);

  useEffect(() => {
    if (!ready || !signedIn) return;
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [ready, signedIn, load, q]);

  // Near-real-time: poll while visible and refresh on focus.
  useEffect(() => {
    if (!ready || !signedIn || !live) return;
    const tick = () => document.visibilityState === "visible" && void load();
    const interval = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", tick);
    };
  }, [ready, signedIn, live, load]);

  if (!ready) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock /></main>;
  if (!signedIn) return <SignInRequired />;
  if (!view && !error) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock label="Loading attendance…" /></main>;
  if (!view) return <main className="mx-auto max-w-6xl px-4 py-12"><ErrorBanner message={error} onRetry={() => void load()} /></main>;

  const s = view.stats;

  function exportCsv() {
    const csv = toCsv(
      ["Name", "Role", "Guest status", "Pass ID", "Pass status", "Checked in at"],
      view!.rows.map((r) => [r.name, GUEST_ROLE_LABELS[r.role], r.guestStatus, r.passPublicId ?? "", r.passStatus ?? "", r.checkedInAt ?? ""]),
    );
    downloadFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), `attendance-${eventId}.csv`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to={`/events/${eventId}/manage`} className="text-sm text-ink-muted hover:text-ink">
        ← {eventName || "Event"}
      </Link>
      <div className="mt-3">
        <PageTitle eyebrow="Attendance" title={eventName || "Attendance"}>
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </PageTitle>
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted" aria-live="polite">
        <span className={cn("inline-block h-2 w-2 rounded-full", live && !error ? "animate-soft-pulse bg-emerald-500" : "bg-stone-400")} aria-hidden />
        {live ? `Live · updated ${new Date(view.generatedAt).toLocaleTimeString()}` : "Paused"}
        <button type="button" className="underline" onClick={() => setLive((v) => !v)}>
          {live ? "Pause" : "Resume"}
        </button>
      </p>
      {eventId ? <EventSubNav eventId={eventId} /> : null}
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Max capacity" value={s.maxCapacity} />
        <StatCard label="Invited" value={s.invited} />
        <StatCard label="Checked in" value={s.checkedIn} tone="green" />
        <StatCard label="Not checked in" value={s.notCheckedIn} />
        <StatCard label="Attendance" value={`${s.attendancePercent}%`} tone="gold" />
      </section>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-label="Attendance" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.attendancePercent}>
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${s.attendancePercent}%` }} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section aria-labelledby="recent-heading" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 id="recent-heading" className="font-serif text-2xl">
            Recent check-ins
          </h2>
          {view.recent.length ? (
            <ol className="mt-3 divide-y divide-stone-100 text-sm">
              {view.recent.map((r) => (
                <li key={`${r.guestId}-${r.checkedInAt}`} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="text-xs text-ink-muted">{GUEST_ROLE_LABELS[r.role]}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums">{formatEventTime(r.checkedInAt, timezone)}</span>
                    <StatusBadge status={r.passStatus ?? "NO_PASS"} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">No one has checked in yet.</p>
          )}
        </section>

        <section aria-labelledby="all-heading" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 id="all-heading" className="font-serif text-2xl">
            Guests
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <div role="group" aria-label="Filter" className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn("rounded-full px-3 py-1.5 text-sm", filter === f.id ? "bg-ink text-cream" : "border border-stone-300 bg-white")}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Input aria-label="Search attendance" placeholder="Search name or pass ID" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[180px] flex-1" />
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Guests filtered by {filter.toLowerCase().replace(/_/g, " ")}</caption>
              <thead className="text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3">Name</th>
                  <th scope="col" className="py-2 pr-3">Role</th>
                  <th scope="col" className="py-2 pr-3">Time</th>
                  <th scope="col" className="py-2">Pass</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.guestId} className="border-t border-stone-100">
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3">{GUEST_ROLE_LABELS[r.role]}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.checkedInAt ? formatEventTime(r.checkedInAt, timezone) : "—"}</td>
                    <td className="py-2">
                      <StatusBadge status={r.guestStatus === "CANCELLED" ? "CANCELLED" : (r.passStatus ?? "NO_PASS")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!view.rows.length ? <p className="py-6 text-center text-sm text-ink-muted">No guests match.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
