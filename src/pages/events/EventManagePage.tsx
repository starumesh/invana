import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { formatDuration, formatEventDate, formatEventTime, type EventOverview, type StaffAssignment } from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { LocationMap } from "@/components/events/LocationMap";
import { CalendarActions, ShareActions } from "@/components/events/ShareActions";
import { ConfirmDialog, ErrorBanner, LoadingBlock, Notice, PageTitle, SignInRequired, StatCard, StatusBadge } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { Input } from "@/components/ui/Field";
import { eventWhatsAppText, publicEventUrl } from "@/lib/eventShare";
import { openInMapsUrl } from "@/lib/maps";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

type Action = "publish" | "unpublish" | "cancel" | "complete";

const ACTION_COPY: Record<Action, { title: string; body: string; label: string; done: string }> = {
  publish: {
    title: "Publish this invitation?",
    body: "A public invitation page goes live and guest passes become valid for check-in.",
    label: "Publish",
    done: "Published! Your public page is live — use Share to send it.",
  },
  unpublish: {
    title: "Unpublish this invitation?",
    body: "The public page goes offline and check-in pauses. Guest passes are kept and work again when you re-publish.",
    label: "Unpublish",
    done: "Unpublished. It's a draft again.",
  },
  cancel: {
    title: "Cancel this event?",
    body: "This can't be undone. The public page will show the event as cancelled and no passes can be checked in.",
    label: "Cancel event",
    done: "Event cancelled.",
  },
  complete: {
    title: "Mark as completed?",
    body: "Check-in closes and the invitation moves to your past invitations. Attendance stays available.",
    label: "Mark completed",
    done: "Marked as completed.",
  },
};

/** Invitation overview: one action bar, then read-only summaries (no repeated buttons). */
export function EventManagePage() {
  const { eventId = "" } = useParams();
  const location = useLocation();
  const { ready, signedIn } = useAuthSession();
  const [data, setData] = useState<EventOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    try {
      setData(await eventsApi.overview(eventId));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Unable to load this invitation. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (ready && signedIn) void reload();
  }, [ready, signedIn, reload]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => !moreRef.current?.contains(e.target as Node) && setMoreOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [moreOpen]);

  if (ready && !signedIn) return <SignInRequired />;
  if (!ready || loading) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock label="Loading invitation…" /></main>;
  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <ErrorBanner message={error ?? "You don't have permission to access this event."} onRetry={() => void reload()} />
        <Link to="/events" className={buttonClassName("secondary", "sm", "mt-6")}>
          Back to My Invitations
        </Link>
      </main>
    );
  }

  const { event, stats, timeline } = data;
  const point = { lat: event.latitude, lng: event.longitude };
  const url = event.slug && event.status !== "DRAFT" ? publicEventUrl(event.slug) : null;
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";

  async function run(action: Action) {
    setBusy(true);
    setError(null);
    try {
      await eventsApi.transition(event.id, action);
      await reload();
      setNotice(ACTION_COPY[action].done);
      if (action === "publish") setShareOpen(true);
    } catch (err) {
      setError(errorMessage(err, "Unable to update the invitation status. Please try again."));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const moreItems: { label: string; to?: string; action?: Action }[] = [
    { label: "Check-in", to: `/events/${event.id}/check-in` },
    { label: "Attendance", to: `/events/${event.id}/attendance` },
    ...(event.status === "PUBLISHED" ? [{ label: "Unpublish", action: "unpublish" as const }, { label: "Mark completed", action: "complete" as const }] : []),
    ...(editable ? [{ label: "Cancel event", action: "cancel" as const }] : []),
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/events" className="text-sm text-ink-muted hover:text-ink">
        ← My Invitations
      </Link>
      <div className="mt-3">
        <PageTitle eyebrow={event.publicId} title={event.name}>
          <StatusBadge status={event.status} className="self-center" />
        </PageTitle>
      </div>
      <p className="mt-2 text-ink-muted">
        {formatEventDate(event.startDatetime, event.timezone)} · {formatEventTime(event.startDatetime, event.timezone)} · {formatDuration(event.durationMinutes)} ·{" "}
        {event.venueName}, {event.city}
      </p>

      <nav aria-label="Invitation actions" className="sticky top-16 z-20 -mx-4 mt-6 border-y border-stone-200 bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Link to={`/events/${event.id}/edit`} className={buttonClassName("secondary", "sm")}>
              Edit
            </Link>
          ) : null}
          <Button size="sm" variant={shareOpen ? "primary" : "secondary"} aria-expanded={shareOpen} aria-controls="share-panel" onClick={() => setShareOpen((v) => !v)}>
            Share
          </Button>
          <Link to={`/events/${event.id}/guests`} className={buttonClassName("secondary", "sm")}>
            Manage Guests
          </Link>
          <Link to={`/events/${event.id}/passes`} className={buttonClassName("secondary", "sm")}>
            View Passes
          </Link>
          {event.status === "DRAFT" ? (
            <Button size="sm" variant="gold" onClick={() => setPending("publish")} disabled={busy}>
              Publish
            </Button>
          ) : null}
          <div ref={moreRef} className="relative ml-auto">
            <Button size="sm" variant="ghost" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
              More ▾
            </Button>
            {moreOpen ? (
              <ul role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 text-sm shadow-lift">
                {moreItems.map((item) => (
                  <li key={item.label} role="none">
                    {item.to ? (
                      <Link role="menuitem" to={item.to} className="block px-4 py-2 hover:bg-cream focus:bg-cream focus:outline-none">
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        role="menuitem"
                        type="button"
                        className="block w-full px-4 py-2 text-left hover:bg-cream focus:bg-cream focus:outline-none"
                        onClick={() => {
                          setMoreOpen(false);
                          setPending(item.action!);
                        }}
                      >
                        {item.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </nav>

      {shareOpen ? (
        <section id="share-panel" aria-label="Share invitation" className="mt-4 rounded-3xl border border-gold/40 bg-white p-5 shadow-sm">
          {url ? (
            <>
              <p className="break-all rounded-xl bg-cream px-3 py-2 font-mono text-sm">
                <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                  {url}
                </a>
              </p>
              <div className="mt-3">
                <ShareActions url={url} title={event.name} whatsAppText={eventWhatsAppText(event, url)} compact />
              </div>
              <CalendarActions
                filename={`${event.slug}.ics`}
                event={{
                  title: event.name,
                  description: event.description,
                  location: [event.venueName, event.address, event.city].filter(Boolean).join(", "),
                  startIso: event.startDatetime,
                  durationMinutes: event.durationMinutes,
                  url,
                  uid: event.id,
                }}
              />
              <p className="mt-3 text-xs text-ink-muted">This is the public invitation. Each guest's personal pass is shared from Manage Guests.</p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Publish the invitation to get a public link you can share on WhatsApp.</p>
          )}
        </section>
      ) : null}

      <div className="mt-6 space-y-3">
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        <ErrorBanner message={error} />
      </div>

      <section aria-label="Guest progress" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Guests" value={stats.invited} hint={`of ${stats.maxCapacity} capacity`} />
        <StatCard label="Passes generated" value={stats.passesIssued} hint={stats.passesPending ? `${stats.passesPending} without a pass` : "All guests have passes"} />
        <StatCard label="Passes shared" value={stats.passesShared} hint={`${Math.max(0, stats.passesIssued - stats.passesShared)} not shared yet`} />
        <StatCard label="Checked in" value={stats.checkedIn} tone="green" hint={`${stats.attendancePercent}% attendance`} />
        <StatCard label="Seats left" value={Math.max(0, stats.maxCapacity - stats.invited)} tone="gold" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="venue-heading" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 id="venue-heading" className="font-serif text-2xl">
            Venue
          </h2>
          <p className="mt-2 text-sm">
            {event.venueName}
            <br />
            <span className="text-ink-muted">{[event.address, event.city, event.state, event.country].filter(Boolean).join(", ")}</span>
          </p>
          <div className="mt-3">
            <LocationMap value={point} label={`Map of ${event.venueName}`} height={200} />
          </div>
          <a href={openInMapsUrl(point)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-gold-dark underline">
            Open in Maps ↗
          </a>
        </section>

        <section aria-labelledby="timeline-heading" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 id="timeline-heading" className="font-serif text-2xl">
            Timeline
          </h2>
          {timeline.length ? (
            <ol className="mt-3 space-y-3 border-l-2 border-gold/40 pl-4">
              {timeline.map((t) => (
                <li key={t.id} className="text-sm">
                  <p className="tabular-nums text-gold-dark">
                    {formatEventTime(t.startTime, event.timezone)} – {formatEventTime(t.endTime, event.timezone)}
                  </p>
                  <p className="font-medium">{t.title}</p>
                  {t.location ? <p className="text-ink-muted">{t.location}</p> : null}
                  {t.description ? <p className="text-ink-muted">{t.description}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">No timeline yet — add one with Edit.</p>
          )}
        </section>
      </div>

      <StaffPanel eventId={event.id} />

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTION_COPY[pending].title : ""}
        body={pending ? ACTION_COPY[pending].body : ""}
        confirmLabel={pending ? ACTION_COPY[pending].label : ""}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void run(pending)}
      />
    </main>
  );
}

function StaffPanel({ eventId }: { eventId: string }) {
  const [staff, setStaff] = useState<StaffAssignment[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void eventsApi
      .listStaff(eventId)
      .then(setStaff)
      .catch((err) => setError(errorMessage(err, "Unable to load staff.")));
  }, [eventId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await eventsApi.addStaff(eventId, email);
      setStaff((list) => [...(list ?? []), s]);
      setEmail("");
    } catch (err) {
      setError(errorMessage(err, "Unable to add this staff member."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="staff-heading" className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 id="staff-heading" className="font-serif text-2xl">
        Door staff
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Staff sign in with this email and can only scan passes and search guests for this event. They never see full contact details.
      </p>
      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2" noValidate>
        <Input
          type="email"
          inputMode="email"
          aria-label="Staff email"
          placeholder="staff@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" size="sm" disabled={busy || !email}>
          Add staff
        </Button>
      </form>
      <div className="mt-3">
        <ErrorBanner message={error} />
      </div>
      {staff?.length ? (
        <ul className="mt-3 divide-y divide-stone-100 text-sm">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {s.email} <span className="text-xs text-ink-muted">{s.userId ? "· active" : "· invited"}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${s.email}`}
                onClick={async () => {
                  try {
                    await eventsApi.removeStaff(eventId, s.id);
                    setStaff((list) => (list ?? []).filter((x) => x.id !== s.id));
                  } catch (err) {
                    setError(errorMessage(err, "Unable to remove this staff member."));
                  }
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : staff ? (
        <p className="mt-3 text-sm text-ink-muted">No staff yet — you can run check-in yourself.</p>
      ) : null}
    </section>
  );
}
