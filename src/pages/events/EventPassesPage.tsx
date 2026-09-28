import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEventTime, GUEST_ROLE_LABELS, toCsv, type GuestWithPass } from "@event-core";
import { ConfirmDialog, ErrorBanner, EventSubNav, LoadingBlock, Notice, PageTitle, ProgressBar, SignInRequired, StatusBadge } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { downloadFile } from "@/lib/download";
import { copyText, guestPassUrl, passWhatsAppText, whatsAppUrl } from "@/lib/eventShare";
import { errorMessage, eventsApi, generateAllPasses } from "@/services/eventManagement/client";
import { useEventDetail } from "@/pages/events/useEventDetail";

export function EventPassesPage() {
  const { eventId } = useParams();
  const { ready, signedIn, detail, error, setError, loading, reload } = useEventDetail(eventId);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<GuestWithPass | null>(null);
  const [progress, setProgress] = useState<{ issued: number; total: number } | null>(null);

  if (!ready) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock /></main>;
  if (!signedIn) return <SignInRequired />;
  if (loading) return <main className="mx-auto max-w-6xl px-4 py-12"><LoadingBlock label="Loading passes…" /></main>;
  if (!detail) return <main className="mx-auto max-w-6xl px-4 py-12"><ErrorBanner message={error} onRetry={() => void reload()} /></main>;

  const { event, stats } = detail;
  const withPass = detail.guests.filter((g) => g.pass);
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";

  async function act(fn: () => Promise<void>, fallback: string) {
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

  async function open(g: GuestWithPass, how: "open" | "copy" | "whatsapp") {
    const tab = how === "open" ? window.open("about:blank", "_blank") : null;
    await act(async () => {
      const s = await eventsApi.sharePass(event.id, g.id);
      const url = guestPassUrl(s.passToken);
      if (how === "open") {
        if (tab) tab.location.href = url;
        else window.location.href = url;
      } else if (how === "copy") {
        setNotice((await copyText(url)) ? `Pass link for ${g.name} copied.` : url);
      } else {
        window.open(whatsAppUrl(passWhatsAppText(event, g.name, url), s.phone), "_blank", "noopener");
      }
    }, "Unable to share this pass. Please try again.");
  }

  async function exportCsv() {
    await act(async () => {
      const rows = await eventsApi.exportPasses(event.id);
      const csv = toCsv(
        ["Name", "Email", "Phone", "Role", "Pass ID", "Status", "Pass link"],
        rows.map((r) => [r.name, r.email, r.phone, GUEST_ROLE_LABELS[r.role as keyof typeof GUEST_ROLE_LABELS] ?? r.role, r.passPublicId, r.status, guestPassUrl(r.passToken)]),
      );
      downloadFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${event.publicId}-passes.csv`);
      setNotice("Pass links exported. Keep this file private — each link opens a guest's pass.");
    }, "Unable to export passes.");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to={`/events/${event.id}/manage`} className="text-sm text-ink-muted hover:text-ink">
        ← {event.name}
      </Link>
      <div className="mt-3">
        <PageTitle eyebrow="Guest passes" title={`${stats.passesIssued} passes issued`}>
          {stats.passesPending && editable ? (
            <Button
              size="sm"
              variant="gold"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  setProgress({ issued: stats.passesIssued, total: stats.invited });
                  await generateAllPasses(event.id, setProgress);
                  setProgress(null);
                  await reload();
                }, "Unable to generate guest passes. Please try again.")
              }
            >
              Generate {stats.passesPending} pending
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => void exportCsv()} disabled={busy || !withPass.length}>
            Export links (CSV)
          </Button>
        </PageTitle>
      </div>
      <EventSubNav eventId={event.id} />
      <div className="mt-6 space-y-3">
        {event.status === "DRAFT" ? <Notice tone="warn">Passes can be shared now, but check-in only works after you publish the event.</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        <ErrorBanner message={error} />
        {progress ? <ProgressBar value={progress.issued} max={progress.total} label="Generating guest passes" /> : null}
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {withPass.map((g) => (
          <li key={g.id} className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{g.name}</p>
                <p className="text-xs text-ink-muted">{GUEST_ROLE_LABELS[g.role]}</p>
              </div>
              <StatusBadge status={g.pass!.status} />
            </div>
            <p className="mt-3 font-mono text-sm font-semibold tracking-wide">{g.pass!.publicId}</p>
            <p className="text-xs text-ink-muted">
              {g.pass!.checkedInAt ? `Checked in at ${formatEventTime(g.pass!.checkedInAt, event.timezone)}` : `Issued ${new Date(g.pass!.issuedAt).toLocaleDateString()}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {g.pass!.status !== "CANCELLED" ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => void open(g, "open")} aria-label={`Open pass for ${g.name}`}>
                    Open
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void open(g, "whatsapp")} aria-label={`Send pass to ${g.name} on WhatsApp`}>
                    WhatsApp
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void open(g, "copy")} aria-label={`Copy pass link for ${g.name}`}>
                    Copy
                  </Button>
                </>
              ) : null}
              {editable && g.pass!.status === "ISSUED" ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Reissue pass for ${g.name}`}
                    onClick={() =>
                      void act(async () => {
                        await eventsApi.reissuePass(event.id, g.pass!.id);
                        setNotice(`New link issued for ${g.name}. The old link and QR no longer work.`);
                        await reload();
                      }, "Unable to reissue this pass.")
                    }
                  >
                    Reissue
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCancelling(g)} aria-label={`Cancel pass for ${g.name}`}>
                    Cancel
                  </Button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!withPass.length ? (
        <div className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-ink-muted">
          No passes yet. Add guests and generate passes.
        </div>
      ) : null}

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this pass?"
        body={`${cancelling?.name}'s QR code will show "Pass Cancelled" at the door. You can reinstate it later from Guests.`}
        confirmLabel="Cancel pass"
        busy={busy}
        onCancel={() => setCancelling(null)}
        onConfirm={() =>
          cancelling &&
          void act(async () => {
            await eventsApi.cancelPass(event.id, cancelling.pass!.id);
            setCancelling(null);
            await reload();
          }, "Unable to cancel this pass.")
        }
      />
    </main>
  );
}
