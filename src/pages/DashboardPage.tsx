import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "@/auth/AuthSession";
import { useRequireSignIn } from "@/auth/useRequireSignIn";
import {
  DashboardEventActions,
  type DashboardPanel,
} from "@/components/editor/DashboardEventActions";
import { DashboardDownloadPanel } from "@/components/editor/DashboardDownloadPanel";
import { PublishPanel } from "@/components/editor/PublishPanel";
import { SharePanel } from "@/components/editor/SharePanel";
import { Button } from "@/components/ui/Button";
import { DeleteIcon } from "@/components/ui/Icons";
import { deleteEvent, listMyEvents, listRsvpsForEvents, publishEvent } from "@/api/events";
import { inviteUrl } from "@/lib/url";
import type { Rsvp, RsvpResponse, StoredEvent } from "@/types";

type Row = StoredEvent & { rsvps: Rsvp[] };
type Panel = DashboardPanel;
type RsvpFilter = "all" | RsvpResponse;

export function DashboardPage() {
  const { ready, isDemoMode, signedIn } = useAuthSession();
  const allowSignedInAction = useRequireSignIn();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [rsvpFilterByEvent, setRsvpFilterByEvent] = useState<Record<string, RsvpFilter>>({});
  const [rsvpDetailsOpen, setRsvpDetailsOpen] = useState<Record<string, boolean>>({});

  function rsvpFilterFor(eventId: string): RsvpFilter {
    return rsvpFilterByEvent[eventId] ?? "all";
  }

  function setRsvpFilter(eventId: string, next: RsvpFilter) {
    setRsvpFilterByEvent((prev) => {
      const cleared = prev[eventId] === next;
      return { ...prev, [eventId]: cleared ? "all" : next };
    });
    setRsvpDetailsOpen((prev) => ({ ...prev, [eventId]: true }));
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const events = (await listMyEvents()).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        );
        if (cancelled) return;
        setRows(events.map((event) => ({ ...event, rsvps: [] })));
        setLoading(false);

        if (!events.length) return;

        try {
          const rsvpMap = await listRsvpsForEvents(events.map((event) => event.id));
          if (cancelled) return;
          setRows(
            events.map((event) => ({
              ...event,
              rsvps: rsvpMap.get(event.id) ?? [],
            })),
          );
        } catch {
          /* list already visible */
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load events.");
        setRows([]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signedIn/isDemoMode gate reload
  }, [ready, isDemoMode, signedIn]);

  function requestRemove(row: Row) {
    if (row.status === "published") {
      setPendingDelete({ id: row.id, title: row.title });
      return;
    }
    void remove(row.id);
  }

  async function remove(id: string) {
    setPendingDelete(null);
    try {
      await deleteEvent(id);
    } catch {
      /* UI already optimistic below */
    }
    setRows((prev) => prev.filter((row) => row.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setPanel(null);
    }
  }

  function togglePanel(id: string, next: Panel) {
    if (activeId === id && panel === next) {
      setActiveId(null);
      setPanel(null);
      return;
    }
    if (next === "publish" || next === "share") {
      if (!allowSignedInAction({ mode: "account" })) return;
    }
    setActiveId(id);
    setPanel(next);
  }

  async function onPublish(event: StoredEvent, slug: string) {
    const stored = await publishEvent(event, slug);
    setRows((prev) =>
      prev.map((row) => (row.id === stored.id ? { ...row, ...stored } : row)),
    );
    setPanel("share");
    setActiveId(stored.id);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">My events</h1>
          <p className="mt-2 text-ink-muted">Open, publish, and share your invitations and cards.</p>
        </div>
        <Link to="/create">
          <Button variant="gold">Create invitation</Button>
        </Link>
      </div>

      {error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="mt-10 rounded-3xl border border-stone-200 bg-white/70 px-6 py-14 text-center">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-gold/40 border-t-gold animate-soft-pulse" />
          <p className="mt-4 text-ink-muted">Loading your events…</p>
        </div>
      ) : null}

      {!loading && !rows.length ? (
        <div className="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <h2 className="font-serif text-2xl">No events yet</h2>
          <p className="mt-2 text-ink-muted">Start with an invitation — you can publish and share it from here.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/create">
              <Button variant="gold">Create invitation</Button>
            </Link>
            <Link to="/create/card">
              <Button variant="secondary">Create card</Button>
            </Link>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-event-title"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-cream p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-gold-dark">Delete event</p>
            <h2 id="delete-event-title" className="mt-2 font-serif text-2xl text-ink">
              Delete “{pendingDelete.title}”?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              This invitation is published. Deleting it will permanently remove the event, and the invite
              link will stop working for anyone who has it.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" variant="primary" onClick={() => void remove(pendingDelete.id)}>
                <DeleteIcon />
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        {rows.map((row) => {
          const yes = row.rsvps.filter((r) => r.response === "yes").length;
          const no = row.rsvps.filter((r) => r.response === "no").length;
          const maybe = row.rsvps.filter((r) => r.response === "maybe").length;
          const isInvitation = row.config.kind === "invitation";
          const open = activeId === row.id ? panel : null;
          const hostRsvpNote = (() => {
            const value = row.config.fields?.rsvpNote;
            return typeof value === "string" ? value.trim() : "";
          })();
          const filter = rsvpFilterFor(row.id);
          const filteredRsvps =
            filter === "all" ? row.rsvps : row.rsvps.filter((r) => r.response === filter);
          return (
            <article key={row.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                    {row.status === "published" ? "Published" : "Saved"}
                    {" · "}
                    {isInvitation ? "Invitation" : "Bio Data"}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl">{row.title}</h2>
                  {isInvitation ? (
                    row.rsvps.length ? (
                      <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-ink-muted">
                        <span>RSVP {row.rsvps.length}</span>
                        <span aria-hidden>·</span>
                        <button
                          type="button"
                          className={`rounded-full px-2 py-0.5 transition ${
                            filter === "yes"
                              ? "bg-ink text-cream"
                              : "hover:bg-stone-100 hover:text-ink"
                          }`}
                          onClick={() => setRsvpFilter(row.id, "yes")}
                        >
                          Yes {yes}
                        </button>
                        <span aria-hidden>·</span>
                        <button
                          type="button"
                          className={`rounded-full px-2 py-0.5 transition ${
                            filter === "no"
                              ? "bg-ink text-cream"
                              : "hover:bg-stone-100 hover:text-ink"
                          }`}
                          onClick={() => setRsvpFilter(row.id, "no")}
                        >
                          No {no}
                        </button>
                        <span aria-hidden>·</span>
                        <button
                          type="button"
                          className={`rounded-full px-2 py-0.5 transition ${
                            filter === "maybe"
                              ? "bg-ink text-cream"
                              : "hover:bg-stone-100 hover:text-ink"
                          }`}
                          onClick={() => setRsvpFilter(row.id, "maybe")}
                        >
                          Maybe {maybe}
                        </button>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-ink-muted">No RSVPs yet</p>
                    )
                  ) : null}
                  {isInvitation && row.status === "published" ? (
                    <a
                      className="mt-2 inline-block break-all text-sm text-gold-dark underline"
                      href={inviteUrl(row.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {inviteUrl(row.slug)}
                    </a>
                  ) : null}
                </div>

                <DashboardEventActions
                  event={row}
                  open={open}
                  onToggle={(next) => togglePanel(row.id, next)}
                  onDelete={() => requestRemove(row)}
                />
              </div>

              {open ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-cream/30">
                  {open === "download" ? <DashboardDownloadPanel event={row} /> : null}
                  {isInvitation && open === "publish" ? (
                    <PublishPanel
                      eventId={row.id}
                      titleParts={[row.title, row.config.eventType ?? row.config.cardType ?? "invite"]}
                      currentSlug={row.slug}
                      status={row.status}
                      onPublish={(slug) => onPublish(row, slug)}
                    />
                  ) : null}
                  {isInvitation && open === "share" ? (
                    <SharePanel
                      slug={row.slug}
                      title={row.title}
                      published={row.status === "published"}
                      defaultMessage={`You're invited — ${row.title}. Please RSVP:`}
                    />
                  ) : null}
                </div>
              ) : null}

              {isInvitation && row.rsvps.length ? (
                <details
                  className="group mt-4 rounded-xl border border-stone-200/80 bg-cream/40 open:bg-cream/60"
                  open={Boolean(rsvpDetailsOpen[row.id])}
                  onToggle={(e) => {
                    setRsvpDetailsOpen((prev) => ({
                      ...prev,
                      [row.id]: (e.target as HTMLDetailsElement).open,
                    }));
                  }}
                >
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      <span>
                        <span className="font-medium">RSVP details</span>
                        <span className="text-ink-muted">
                          {" "}
                          · {filteredRsvps.length}
                          {filter === "all" ? "" : ` ${filter}`}
                          {filteredRsvps.length === 1 ? " reply" : " replies"}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs uppercase tracking-wide text-ink-muted group-open:hidden">
                        Show
                      </span>
                      <span className="hidden shrink-0 text-xs uppercase tracking-wide text-ink-muted group-open:inline">
                        Hide
                      </span>
                    </span>
                  </summary>
                  <div className="border-t border-stone-200/70 px-4 pb-3">
                    {hostRsvpNote ? (
                      <p className="pt-3 text-xs leading-relaxed text-ink-muted">Your note · {hostRsvpNote}</p>
                    ) : null}
                    {filter !== "all" ? (
                      <div className="flex items-center justify-between gap-2 pt-3 text-xs text-ink-muted">
                        <span>
                          Showing {filter} ({filteredRsvps.length})
                        </span>
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-ink"
                          onClick={() => setRsvpFilter(row.id, "all")}
                        >
                          Clear filter
                        </button>
                      </div>
                    ) : null}
                    {filteredRsvps.length ? (
                      <ul className="mt-1 max-h-64 divide-y divide-stone-100 overflow-y-auto text-sm">
                        {filteredRsvps.map((rsvp) => {
                          const note = rsvp.message?.trim();
                          return (
                            <li
                              key={rsvp.id}
                              className="flex items-center justify-between gap-3 py-2 text-ink"
                            >
                              <p className="min-w-0 flex-1 truncate">
                                <span>{rsvp.guestName}</span>
                                {rsvp.partySize > 1 ? (
                                  <span className="text-ink-muted"> ×{rsvp.partySize}</span>
                                ) : null}
                                {note ? <span className="text-ink-muted"> · {note}</span> : null}
                              </p>
                              <span className="shrink-0 text-xs uppercase tracking-wide text-ink-muted">
                                {rsvp.response}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="py-3 text-sm text-ink-muted">No {filter} replies yet.</p>
                    )}
                  </div>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>
    </main>
  );
}
