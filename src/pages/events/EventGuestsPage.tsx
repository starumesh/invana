import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { EventOverview, GuestRow, GuestWithPass } from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { CsvImport, GuestForm } from "@/components/events/GuestForms";
import { GUEST_TABS } from "@/components/events/guestTableConfig";
import { GuestTable } from "@/components/events/GuestTable";
import { PassActions } from "@/components/events/PassActions";
import { ConfirmDialog, ErrorBanner, EventSubNav, LoadingBlock, Notice, PageTitle, SignInRequired } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

/** Guests: Add Guest → Generate Pass → Share Pass, each step optional and resumable. */
export function EventGuestsPage() {
  const { eventId = "" } = useParams();
  const location = useLocation();
  const navState = location.state as { notice?: string; select?: string } | null;
  const { ready, signedIn } = useAuthSession();
  const [overview, setOverview] = useState<EventOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(navState?.notice ?? null);
  const [panel, setPanel] = useState<"none" | "single" | "csv">("none");
  const [existing, setExisting] = useState<{ name: string; email: string; phone: string }[] | null>(null);
  const [justAdded, setJustAdded] = useState<GuestWithPass | null>(null);
  const [editing, setEditing] = useState<GuestRow | null>(null);
  const [removing, setRemoving] = useState<GuestRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await eventsApi.overview(eventId));
    } catch (err) {
      setError(errorMessage(err, "Unable to load this invitation. Please try again."));
    }
  }, [eventId]);

  useEffect(() => {
    if (ready && signedIn) void loadOverview();
  }, [ready, signedIn, loadOverview]);

  // CSV duplicate checks need every existing guest — fetched only when importing.
  useEffect(() => {
    if (panel !== "csv" || existing) return;
    void eventsApi
      .exportGuests(eventId, { filter: "ALL" })
      .then((rows) => setExisting(rows.filter((r) => r.stage !== "CANCELLED")))
      .catch(() => setExisting([]));
  }, [panel, existing, eventId]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    void loadOverview();
  }, [loadOverview]);

  if (ready && !signedIn) return <SignInRequired />;
  if (!overview) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">{error ? <ErrorBanner message={error} onRetry={() => void loadOverview()} /> : <LoadingBlock label="Loading guests…" />}</main>
    );
  }

  const { event, stats } = overview;
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";
  const remaining = Math.max(0, event.maxCapacity - stats.invited);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to={`/events/${event.id}/manage`} className="text-sm text-ink-muted hover:text-ink">
        ← {event.name}
      </Link>
      <div className="mt-3">
        <PageTitle eyebrow="Manage guests" title={`${stats.invited} / ${event.maxCapacity} guests`}>
          {editable ? (
            <>
              <Button size="sm" variant={panel === "single" ? "primary" : "gold"} onClick={() => setPanel(panel === "single" ? "none" : "single")} disabled={!remaining}>
                Add Guest
              </Button>
              <Button size="sm" variant={panel === "csv" ? "primary" : "secondary"} onClick={() => setPanel(panel === "csv" ? "none" : "csv")} disabled={!remaining}>
                Import CSV
              </Button>
            </>
          ) : null}
        </PageTitle>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        {stats.passesIssued} passes generated · {stats.passesShared} shared · {stats.checkedIn} checked in. Add guests now and generate or share passes whenever you're ready.
      </p>
      <EventSubNav eventId={event.id} />

      <div className="mt-6 space-y-3">
        {!remaining && editable ? <Notice tone="warn">Maximum event capacity has been reached. Increase capacity in Edit to add more guests.</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        <ErrorBanner message={error} />
      </div>

      {panel === "single" ? (
        <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm" aria-label="Add guest">
          <h2 className="mb-4 font-serif text-xl">1. Add guest</h2>
          <GuestForm
            submitLabel="Add Guest"
            busy={busy}
            onSubmit={async (g) => {
              setBusy(true);
              setError(null);
              try {
                const [added] = await eventsApi.addGuests(event.id, [g]);
                setJustAdded({ ...added, pass: null });
                setNotice(null);
                refresh();
                return true;
              } catch (err) {
                setError(errorMessage(err, "Unable to add this guest."));
                return false;
              } finally {
                setBusy(false);
              }
            }}
          />
          {justAdded ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-cream px-4 py-3" role="status">
              <p className="text-sm">
                <span className="font-medium">{justAdded.name}</span> added. Next: <span className="text-ink-muted">2. Generate pass → 3. Share pass</span> — or do it later from the list.
              </p>
              <PassActions
                eventId={event.id}
                event={event}
                guest={justAdded}
                editable={editable}
                onChanged={async () => {
                  const page = await eventsApi.queryGuests(event.id, { q: justAdded.name, limit: 25 });
                  const row = page.rows.find((r) => r.id === justAdded.id);
                  if (row) setJustAdded(row);
                  refresh();
                }}
                onNotice={setNotice}
                onError={setError}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {panel === "csv" ? (
        <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm" aria-label="Import CSV">
          {existing ? (
            <CsvImport
              busy={busy}
              existing={existing}
              remainingCapacity={remaining}
              onImport={async (rows) => {
                setBusy(true);
                setError(null);
                try {
                  await eventsApi.addGuests(event.id, rows);
                  setNotice(`${rows.length} guests imported. Select them in the list and choose Generate passes when you're ready.`);
                  setPanel("none");
                  setExisting(null);
                  refresh();
                } catch (err) {
                  setError(errorMessage(err, "Unable to import these guests."));
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : (
            <p className="text-sm text-ink-muted">Preparing duplicate check…</p>
          )}
        </section>
      ) : null}

      {editing ? (
        <section className="mt-6 rounded-3xl border border-gold/40 bg-white p-5 shadow-sm" aria-label={`Edit ${editing.name}`}>
          <h2 className="mb-4 font-serif text-xl">Edit {editing.name}</h2>
          <GuestForm
            initial={{ name: editing.name, email: editing.email, phone: editing.phone, bio: editing.bio, role: editing.role }}
            submitLabel="Save guest"
            busy={busy}
            onCancel={() => setEditing(null)}
            onSubmit={async (value) => {
              setBusy(true);
              try {
                await eventsApi.updateGuest(event.id, editing.id, value);
                setEditing(null);
                setNotice(`${value.name} updated.`);
                refresh();
                return true;
              } catch (err) {
                setError(errorMessage(err, "Unable to update this guest."));
                return false;
              } finally {
                setBusy(false);
              }
            }}
          />
        </section>
      ) : null}

      <div className="mt-6">
        <GuestTable
          eventId={event.id}
          event={event}
          timezone={event.timezone}
          exportName={event.publicId}
          editable={editable}
          mode="guests"
          tabs={GUEST_TABS}
          initialFilter={navState?.select === "without-pass" ? "NO_PASS" : "ALL"}
          refreshKey={refreshKey}
          onEdit={(r) => {
            setEditing(r);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onRemove={setRemoving}
          onNotice={setNotice}
          onError={setError}
          onCountsChanged={loadOverview}
        />
      </div>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? "guest"}?`}
        body={
          removing?.stage === "CHECKED_IN"
            ? "This guest already checked in, so they'll be marked cancelled to keep the attendance record. Their pass stops working."
            : "Their pass (if any) stops working immediately."
        }
        confirmLabel="Remove guest"
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          setBusy(true);
          try {
            await eventsApi.removeGuest(event.id, removing.id);
            setNotice(`${removing.name} removed.`);
            refresh();
          } catch (err) {
            setError(errorMessage(err, "Unable to remove this guest."));
          } finally {
            setBusy(false);
            setRemoving(null);
          }
        }}
      />
    </main>
  );
}
