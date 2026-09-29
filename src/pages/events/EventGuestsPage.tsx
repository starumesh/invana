import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { GUEST_ROLE_LABELS, GUEST_ROLES, type GuestRole, type GuestWithPass } from "@event-core";
import { CsvImport, GuestForm } from "@/components/events/GuestForms";
import { PassActions } from "@/components/events/PassActions";
import { ConfirmDialog, ErrorBanner, EventSubNav, LoadingBlock, Notice, PageTitle, ProgressBar, SignInRequired } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { EmApiError, errorMessage, eventsApi, generatePassesForGuests } from "@/services/eventManagement/client";
import { useEventDetail } from "@/pages/events/useEventDetail";

type StatusFilter = "ALL" | "INVITED" | "CHECKED_IN" | "CANCELLED" | "NO_PASS";

export function EventGuestsPage() {
  const { eventId } = useParams();
  const location = useLocation();
  const navState = location.state as { notice?: string; select?: string } | null;
  const { ready, signedIn, detail, error, setError, loading, reload } = useEventDetail(eventId);
  const [panel, setPanel] = useState<"none" | "single" | "csv">("none");
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<GuestWithPass | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<GuestRole | "ALL">("ALL");
  const [status, setStatus] = useState<StatusFilter>(
    (location.state as { select?: string } | null)?.select === "without-pass" ? "NO_PASS" : "ALL",
  );
  const [notice, setNotice] = useState<string | null>(navState?.notice ?? null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());


  const guests = useMemo(() => {
    const list = detail?.guests ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((g) => {
      if (role !== "ALL" && g.role !== role) return false;
      if (status === "NO_PASS" && g.pass) return false;
      if (status !== "ALL" && status !== "NO_PASS" && g.status !== status) return false;
      if (!needle) return true;
      return (
        g.name.toLowerCase().includes(needle) ||
        g.email.includes(needle) ||
        (needle.replace(/\D/g, "").length >= 3 && g.phone.includes(needle.replace(/\D/g, ""))) ||
        (g.pass?.publicId.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [detail, q, role, status]);

  if (!ready) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock /></main>;
  if (!signedIn) return <SignInRequired />;
  if (loading) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock label="Loading guests…" /></main>;
  if (!detail) return <main className="mx-auto max-w-6xl px-4 py-12"><ErrorBanner message={error} onRetry={() => void reload()} /></main>;

  const { event, stats } = detail;
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";
  const remaining = Math.max(0, event.maxCapacity - stats.invited);

  async function withBusy(fn: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const canGetPass = (g: GuestWithPass) => !g.pass && g.status !== "CANCELLED";
  const selectable = guests.filter(canGetPass);
  const selectedIds = [...selected].filter((id) => detail.guests.some((g) => g.id === id && canGetPass(g)));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generate(ids: string[]) {
    if (!ids.length) return;
    const names = detail!.guests.filter((g) => ids.includes(g.id)).map((g) => g.name);
    await withBusy(async () => {
      const r = await generatePassesForGuests(event.id, ids, setProgress);
      setSelected(new Set());
      setNotice(
        r.generated === 1
          ? `Pass generated for ${names[0]}. Share it with WhatsApp or Copy link.`
          : `${r.generated} passes generated${r.skipped ? ` (${r.skipped} skipped — already had a pass)` : ""}. Share them from each guest or the Passes page.`,
      );
      await reload();
    }, "Unable to generate guest passes. Please try again.");
    setProgress(null);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to={`/events/${event.id}/manage`} className="text-sm text-ink-muted hover:text-ink">
        ← {event.name}
      </Link>
      <div className="mt-3">
        <PageTitle eyebrow="Guests" title={`${stats.invited} / ${event.maxCapacity} guests`}>
          {editable ? (
            <>
              <Button size="sm" variant={panel === "single" ? "primary" : "secondary"} onClick={() => setPanel(panel === "single" ? "none" : "single")} disabled={!remaining}>
                Add guest
              </Button>
              <Button size="sm" variant={panel === "csv" ? "primary" : "secondary"} onClick={() => setPanel(panel === "csv" ? "none" : "csv")} disabled={!remaining}>
                Import CSV
              </Button>

            </>
          ) : null}
        </PageTitle>
      </div>
      <EventSubNav eventId={event.id} />

      <div className="mt-6 space-y-3">
        {!remaining && editable ? <Notice tone="warn">Maximum event capacity has been reached. Increase capacity in Edit to add more guests.</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        <ErrorBanner message={error} />
        {progress ? <ProgressBar value={progress.done} max={progress.total} label="Generating guest passes" /> : null}
      </div>

      {panel !== "none" ? (
        <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm" aria-label={panel === "single" ? "Add guest" : "Import CSV"}>
          {panel === "single" ? (
            <GuestForm
              submitLabel="Add guest"
              busy={busy}
              onSubmit={async (g) => {
                try {
                  setError(null);
                  await eventsApi.addGuests(event.id, [g]);
                  setNotice(`${g.name} added. Use "Generate Pass" on their row when you're ready.`);
                  await reload();
                  return true;
                } catch (err) {
                  setError(errorMessage(err, "Unable to add this guest."));
                  return false;
                }
              }}
            />
          ) : (
            <CsvImport
              busy={busy}
              existing={detail.guests.filter((g) => g.status !== "CANCELLED")}
              remainingCapacity={remaining}
              onImport={(rows) =>
                withBusy(async () => {
                  await eventsApi.addGuests(event.id, rows);
                  setNotice(`${rows.length} guests imported.`);
                  setPanel("none");
                  await reload();
                }, "Unable to import these guests.")
              }
            />
          )}
        </section>
      ) : null}

      <section aria-label="Guest list" className="mt-6">
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Search guests" placeholder="Search name, email, phone, or pass ID" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[220px] flex-1" />
          <div className="w-40">
            <Select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value as GuestRole | "ALL")}>
              <option value="ALL">All roles</option>
              {GUEST_ROLES.map((r) => (
                <option key={r} value={r}>
                  {GUEST_ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="ALL">All statuses</option>
              <option value="INVITED">Invited</option>
              <option value="CHECKED_IN">Checked in</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_PASS">No pass yet</option>
            </Select>
          </div>
        </div>
        {editable ? (
          <div className="sticky top-16 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-cream/95 px-3 py-2 text-sm backdrop-blur" role="toolbar" aria-label="Pass generation">
            <span className="font-medium" aria-live="polite">
              {selectedIds.length} selected
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(selectable.map((g) => g.id)))} disabled={!selectable.length}>
              Select all without a pass ({selectable.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(selectable.slice(0, 5).map((g) => g.id)))} disabled={!selectable.length}>
              Select next 5
            </Button>
            {selectedIds.length ? (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            ) : null}
            <Button size="sm" variant="gold" className="ml-auto" onClick={() => void generate(selectedIds)} disabled={busy || !selectedIds.length}>
              Generate {selectedIds.length || ""} pass{selectedIds.length === 1 ? "" : "es"}
            </Button>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-ink-muted" aria-live="polite">
          Showing {guests.length} of {detail.guests.length} · {stats.passesPending} without a pass
        </p>
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-3xl border border-stone-200 bg-white">
          {guests.map((g) => (
            <li key={g.id} className={cn("px-4 py-3", g.status === "CANCELLED" && "bg-stone-50")}>
              {editing === g.id ? (
                <GuestForm
                  initial={{ name: g.name, email: g.email, phone: g.phone, bio: g.bio, role: g.role }}
                  submitLabel="Save guest"
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (value) => {
                    try {
                      setError(null);
                      await eventsApi.updateGuest(event.id, g.id, value);
                      setEditing(null);
                      await reload();
                      return true;
                    } catch (err) {
                      setError(err instanceof EmApiError ? err.message : "Unable to update this guest.");
                      return false;
                    }
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {editable ? (
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-[#8c6d45] disabled:opacity-30"
                      checked={selected.has(g.id) && canGetPass(g)}
                      disabled={!canGetPass(g)}
                      onChange={() => toggle(g.id)}
                      aria-label={canGetPass(g) ? `Select ${g.name} for pass generation` : `${g.name} already has a pass`}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {g.name}
                      {g.role !== "GUEST" ? <span className="text-sm font-normal text-ink-muted"> · {GUEST_ROLE_LABELS[g.role]}</span> : null}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {[g.email, g.phone, g.pass?.publicId].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PassActions
                      eventId={event.id}
                      event={event}
                      guest={g}
                      editable={editable}
                      onChanged={reload}
                      onNotice={setNotice}
                      onError={setError}
                    />
                    {editable && g.status !== "CANCELLED" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(g.id)} aria-label={`Edit ${g.name}`}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(g)} aria-label={`Remove ${g.name}`}>
                          Remove
                        </Button>
                      </>
                    ) : null}
                    {editable && g.pass && g.status === "CANCELLED" && g.pass.status === "CANCELLED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void withBusy(async () => {
                            await eventsApi.reissuePass(event.id, g.pass!.id);
                            setNotice(`New pass issued for ${g.name}. Old links no longer work.`);
                            await reload();
                          }, "Unable to reissue this pass.")
                        }
                      >
                        Reinstate
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </li>
          ))}
          {!guests.length ? <li className="px-4 py-8 text-center text-sm text-ink-muted">No guests match.</li> : null}
        </ul>
        <p className="mt-3 text-sm">
          <Link to={`/events/${event.id}/passes`} className={buttonClassName("secondary", "sm")}>
            View passes
          </Link>
        </p>
      </section>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? "guest"}?`}
        body={
          removing?.status === "CHECKED_IN"
            ? "This guest already checked in, so they'll be marked cancelled to keep the attendance record. Their pass stops working."
            : "Their pass will stop working immediately."
        }
        confirmLabel="Remove guest"
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          void withBusy(async () => {
            await eventsApi.removeGuest(event.id, removing.id);
            setNotice(`${removing.name} removed.`);
            setRemoving(null);
            await reload();
          }, "Unable to remove this guest.")
        }
      />
    </main>
  );
}
