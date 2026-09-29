import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { formatDuration, formatEventDate, formatEventTime, type StaffAssignment } from "@event-core";
import { CalendarActions, ShareActions } from "@/components/events/ShareActions";
import { TileMap } from "@/components/events/TileMap";
import {
  ConfirmDialog,
  ErrorBanner,
  EventSubNav,
  LoadingBlock,
  Notice,
  PageTitle,
  SignInRequired,
  StatCard,
  StatusBadge,
} from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { Input } from "@/components/ui/Field";
import { eventWhatsAppText, publicEventUrl } from "@/lib/eventShare";
import { openInMapsUrl } from "@/lib/maps";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";
import { useEventDetail } from "@/pages/events/useEventDetail";

type Action = "publish" | "unpublish" | "cancel" | "complete";

const ACTION_COPY: Record<Action, { title: string; body: string; label: string }> = {
  publish: {
    title: "Publish this event?",
    body: "A public event page will go live and guest passes become valid for check-in.",
    label: "Publish",
  },
  unpublish: {
    title: "Unpublish this event?",
    body: "The public page goes offline and check-in pauses. Guest passes are kept and work again when you re-publish.",
    label: "Unpublish",
  },
  cancel: {
    title: "Cancel this event?",
    body: "This can't be undone. The public page will show the event as cancelled and no passes can be checked in.",
    label: "Cancel event",
  },
  complete: {
    title: "Mark as completed?",
    body: "Check-in closes and the event moves to your past events. Attendance stays available.",
    label: "Mark completed",
  },
};

export function EventManagePage() {
  const { eventId } = useParams();
  const location = useLocation();
  const { ready, signedIn, detail, error, setError, loading, reload } = useEventDetail(eventId);
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock /></main>;
  if (!signedIn) return <SignInRequired />;
  if (loading) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock label="Loading event…" /></main>;
  if (!detail) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <ErrorBanner message={error ?? "You don't have permission to access this event."} onRetry={() => void reload()} />
        <Link to="/events" className={buttonClassName("secondary", "sm", "mt-6")}>
          Back to events
        </Link>
      </main>
    );
  }

  const { event, stats, timeline } = detail;
  const point = { lat: event.latitude, lng: event.longitude };
  const url = event.slug ? publicEventUrl(event.slug) : null;
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";

  async function run(action: Action) {
    setBusy(true);
    setError(null);
    try {
      await eventsApi.transition(event.id, action);
      await reload();
      setNotice(
        action === "publish"
          ? "Published! Your public page is live — share it below."
          : action === "unpublish"
            ? "Event unpublished. It's a draft again."
            : action === "cancel"
              ? "Event cancelled."
              : "Event marked as completed.",
      );
    } catch (err) {
      setError(errorMessage(err, "Unable to update the event status. Please try again."));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/events" className="text-sm text-ink-muted hover:text-ink">
        ← All events
      </Link>
      <div className="mt-3">
        <PageTitle eyebrow={event.publicId} title={event.name}>
          <StatusBadge status={event.status} className="self-center" />
        </PageTitle>
      </div>
      <p className="mt-2 text-ink-muted">
        {formatEventDate(event.startDatetime, event.timezone)} · {formatEventTime(event.startDatetime, event.timezone)} ·{" "}
        {formatDuration(event.durationMinutes)} · {event.venueName}, {event.city}
      </p>
      <EventSubNav eventId={event.id} />

      <div className="mt-6 space-y-3">
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        <ErrorBanner message={error} />
      </div>

      <section aria-label="Actions" className="mt-6 flex flex-wrap gap-2">
        {editable ? (
          <Link to={`/events/${event.id}/edit`} className={buttonClassName("secondary", "sm")}>
            Edit
          </Link>
        ) : null}
        <Link to={`/events/${event.id}/guests`} className={buttonClassName("secondary", "sm")}>
          Manage Guests
        </Link>
        <Link to={`/events/${event.id}/passes`} className={buttonClassName("secondary", "sm")}>
          View Passes
        </Link>
        <Link to={`/events/${event.id}/check-in`} className={buttonClassName("secondary", "sm")}>
          Check-in
        </Link>
        <Link to={`/events/${event.id}/attendance`} className={buttonClassName("secondary", "sm")}>
          Attendance
        </Link>
        {event.status === "DRAFT" ? (
          <Button size="sm" variant="gold" onClick={() => setPending("publish")} disabled={busy}>
            Publish
          </Button>
        ) : null}
        {event.status === "PUBLISHED" ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => setPending("unpublish")} disabled={busy}>
              Unpublish
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPending("complete")} disabled={busy}>
              Mark completed
            </Button>
          </>
        ) : null}
        {editable ? (
          <Button size="sm" variant="ghost" onClick={() => setPending("cancel")} disabled={busy}>
            Cancel event
          </Button>
        ) : null}
      </section>

      <section aria-label="At a glance" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Guests" value={stats.invited} hint={`of ${stats.maxCapacity} capacity`} />
        <StatCard label="Checked in" value={stats.checkedIn} tone="green" hint={`${stats.attendancePercent}% attendance`} />
        <StatCard label="Passes" value={stats.passesIssued} hint={stats.passesPending ? `${stats.passesPending} pending` : "All issued"} />
        <StatCard label="Capacity" value={stats.maxCapacity} hint={`${Math.max(0, stats.maxCapacity - stats.invited)} seats left`} tone="gold" />
      </section>

      {stats.passesPending > 0 && editable ? (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            {stats.passesPending} guest{stats.passesPending === 1 ? " doesn't" : "s don't"} have a pass yet. Passes are only generated for the guests you select.
          </p>
          <Link to={`/events/${event.id}/guests`} state={{ select: "without-pass" }} className={buttonClassName("primary", "sm")}>
            Select guests
          </Link>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="share-heading" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 id="share-heading" className="font-serif text-2xl">
            Share
          </h2>
          {url && event.status !== "DRAFT" ? (
            <>
              <p className="mt-2 break-all rounded-xl bg-cream px-3 py-2 font-mono text-sm">
                <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                  {url}
                </a>
              </p>
              <div className="mt-3">
                <ShareActions url={url} title={event.name} whatsAppText={eventWhatsAppText(event, url)} compact />
              </div>
              <div className="mt-2">
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
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Each guest also has a private pass link — share those from <Link className="underline" to={`/events/${event.id}/passes`}>Passes</Link>.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">Publish the event to get a public link you can share on WhatsApp.</p>
          )}
        </section>

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
            <TileMap value={point} label={`Map of ${event.venueName}`} height={180} />
          </div>
          <a href={openInMapsUrl(point, event.venueName)} target="_blank" rel="noreferrer" className={buttonClassName("secondary", "sm", "mt-3")}>
            Open in Maps
          </a>
        </section>
      </div>

      <section aria-labelledby="timeline-heading" className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 id="timeline-heading" className="font-serif text-2xl">
          Timeline
        </h2>
        {timeline.length ? (
          <ol className="mt-3 divide-y divide-stone-100">
            {timeline.map((t) => (
              <li key={t.id} className="flex gap-4 py-2.5 text-sm">
                <span className="w-32 shrink-0 tabular-nums text-ink-muted">
                  {formatEventTime(t.startTime, event.timezone)} – {formatEventTime(t.endTime, event.timezone)}
                </span>
                <span>
                  <span className="font-medium">{t.title}</span>
                  {t.location ? <span className="text-ink-muted"> · {t.location}</span> : null}
                  {t.description ? <span className="block text-ink-muted">{t.description}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No timeline yet. {editable ? <Link className="underline" to={`/events/${event.id}/edit`}>Add one</Link> : null}</p>
        )}
      </section>

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
