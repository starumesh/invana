import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { guestStage, type GuestStage, type GuestWithPass } from "@event-core";
import { ConfirmDialog } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { copyText, guestPassUrl, nativeShare, passWhatsAppText, whatsAppUrl } from "@/lib/eventShare";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

type ShareableEvent = Parameters<typeof passWhatsAppText>[0];

const STAGE_LABEL: Record<GuestStage, string> = {
  NO_PASS: "Guest Added",
  PASS_GENERATED: "Pass Generated",
  PASS_SHARED: "Pass Shared",
  CHECKED_IN: "Checked In",
  CANCELLED: "Cancelled",
};

const STAGE_STYLE: Record<GuestStage, string> = {
  NO_PASS: "bg-stone-100 text-stone-700 ring-stone-300",
  PASS_GENERATED: "bg-amber-50 text-amber-900 ring-amber-300",
  PASS_SHARED: "bg-sky-50 text-sky-900 ring-sky-300",
  CHECKED_IN: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  CANCELLED: "bg-red-50 text-red-800 ring-red-300",
};

export function GuestStageBadge({ stage }: { stage: GuestStage }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", STAGE_STYLE[stage])}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

/**
 * Add Guest → Generate Pass → Share Pass, one step at a time. Shows where the guest is and
 * makes the next step the primary button; every step can also be done later on its own.
 * The server never issues a second pass for a guest, so repeated clicks are safe.
 */
export function PassActions({
  eventId,
  event,
  guest,
  editable,
  onChanged,
  onNotice,
  onError,
  showBadge = true,
}: {
  eventId: string;
  event: ShareableEvent;
  guest: GuestWithPass;
  editable: boolean;
  onChanged: () => Promise<void> | void;
  onNotice: (msg: string) => void;
  onError: (msg: string | null) => void;
  showBadge?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const pass = guest.pass;
  const stage = guestStage(guest, pass);

  async function run(fn: () => Promise<void>, fallback: string) {
    setBusy(true);
    onError(null);
    try {
      await fn();
    } catch (err) {
      onError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const shareLink = async () => guestPassUrl((await eventsApi.sharePass(eventId, guest.id, "share")).passToken);

  async function view() {
    await run(async () => {
      const { passToken } = await eventsApi.sharePass(eventId, guest.id, "view");
      navigate(`/pass/${passToken}`, { state: { from: `${location.pathname}${location.search}`, fromLabel: "Back to guests" } });
    }, "Unable to open this pass. Please try again.");
  }

  const regenerate =
    editable && pass && pass.status !== "CHECKED_IN" ? (
      <Button size="sm" variant="ghost" disabled={busy} aria-label={`Regenerate pass for ${guest.name}`} onClick={() => setConfirmRegen(true)}>
        {pass.status === "CANCELLED" ? "Reinstate" : "Regenerate"}
      </Button>
    ) : null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {showBadge ? <GuestStageBadge stage={stage} /> : null}

      {stage === "NO_PASS" && editable ? (
        <Button
          size="sm"
          variant="gold"
          disabled={busy}
          aria-label={`Generate pass for ${guest.name}`}
          onClick={() =>
            void run(async () => {
              await eventsApi.generatePassesFor(eventId, [guest.id]);
              onNotice(`Pass generated for ${guest.name}. Share it now, or later from this list.`);
              await onChanged();
              setSharing(true);
            }, "Unable to generate guest passes. Please try again.")
          }
        >
          {busy ? "Generating…" : "Generate Pass"}
        </Button>
      ) : null}

      {stage === "PASS_GENERATED" || stage === "PASS_SHARED" ? (
        <Button
          size="sm"
          variant={stage === "PASS_GENERATED" ? "gold" : "secondary"}
          aria-expanded={sharing}
          aria-label={`${stage === "PASS_SHARED" ? "Share again" : "Share pass"} with ${guest.name}`}
          onClick={() => setSharing((v) => !v)}
        >
          {stage === "PASS_SHARED" ? "Share again" : "Share Pass"}
        </Button>
      ) : null}

      {pass && pass.status !== "CANCELLED" ? (
        <Button size="sm" variant="secondary" disabled={busy} aria-label={`View pass for ${guest.name}`} onClick={() => void view()}>
          View Pass
        </Button>
      ) : null}

      {regenerate}

      {sharing && pass && pass.status !== "CANCELLED" ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-1.5 rounded-xl bg-cream px-2 py-1.5" role="group" aria-label={`Share options for ${guest.name}`}>
          <span className="mr-auto text-xs text-ink-muted">Send {guest.name}'s pass:</span>
          <Button
            size="sm"
            variant="gold"
            onClick={() => {
              const tab = window.open("", "_blank");
              void run(async () => {
                try {
                  const url = await shareLink();
                  const target = whatsAppUrl(passWhatsAppText(event, guest.name, url), guest.phone);
                  if (tab) tab.location.href = target;
                  else window.location.href = target;
                  setSharing(false);
                  onNotice(`Pass shared with ${guest.name} on WhatsApp.`);
                  await onChanged();
                } catch (err) {
                  tab?.close();
                  throw err;
                }
              }, "Unable to share this pass. Please try again.");
            }}
          >
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void run(async () => {
                const url = await shareLink();
                onNotice((await copyText(url)) ? `Pass link for ${guest.name} copied — paste it into any message.` : url);
                setSharing(false);
                await onChanged();
              }, "Unable to share this pass. Please try again.")
            }
          >
            Copy link
          </Button>
          {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void run(async () => {
                  const url = await shareLink();
                  await nativeShare({ title: `Pass for ${guest.name}`, text: passWhatsAppText(event, guest.name, url), url });
                  setSharing(false);
                  await onChanged();
                }, "Unable to share this pass. Please try again.")
              }
            >
              More…
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setSharing(false)}>
            Later
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmRegen}
        title={pass?.status === "CANCELLED" ? `Reinstate ${guest.name}'s pass?` : `Regenerate ${guest.name}'s pass?`}
        body="A new QR code and pass link are issued. The old link and QR stop working immediately — share the new pass with the guest."
        confirmLabel={pass?.status === "CANCELLED" ? "Reinstate" : "Regenerate"}
        busy={busy}
        onCancel={() => setConfirmRegen(false)}
        onConfirm={() =>
          pass &&
          void run(async () => {
            await eventsApi.reissuePass(eventId, pass.id);
            setConfirmRegen(false);
            onNotice(`New pass issued for ${guest.name}. Share it again — the old one no longer works.`);
            await onChanged();
          }, "Unable to regenerate this pass.")
        }
      />
    </div>
  );
}
