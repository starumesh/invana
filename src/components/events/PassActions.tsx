import { useState } from "react";
import type { GuestWithPass } from "@event-core";
import { ConfirmDialog, StatusBadge } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { copyText, guestPassUrl, nativeShare, passWhatsAppText, whatsAppUrl } from "@/lib/eventShare";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

type ShareableEvent = Parameters<typeof passWhatsAppText>[0];

/**
 * Per-guest pass controls, shared by the creation wizard (step 5) and the Guests page:
 * Generate Pass → Pass Generated · View Pass · Share Pass · Regenerate.
 * The server refuses to issue a second pass for a guest, so repeated clicks are safe.
 */
export function PassActions({
  eventId,
  event,
  guest,
  editable,
  onChanged,
  onNotice,
  onError,
}: {
  eventId: string;
  event: ShareableEvent;
  guest: GuestWithPass;
  editable: boolean;
  onChanged: () => Promise<void> | void;
  onNotice: (msg: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const pass = guest.pass;

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

  const link = async () => guestPassUrl((await eventsApi.sharePass(eventId, guest.id)).passToken);

  if (guest.status === "CANCELLED" && !pass) return <StatusBadge status="CANCELLED" />;

  if (!pass) {
    return editable ? (
      <Button
        size="sm"
        variant="gold"
        disabled={busy}
        aria-label={`Generate pass for ${guest.name}`}
        onClick={() =>
          void run(async () => {
            await eventsApi.generatePassesFor(eventId, [guest.id]);
            onNotice(`Pass generated for ${guest.name}.`);
            await onChanged();
          }, "Unable to generate guest passes. Please try again.")
        }
      >
        {busy ? "Generating…" : "Generate Pass"}
      </Button>
    ) : (
      <StatusBadge status="NO_PASS" />
    );
  }

  const active = pass.status !== "CANCELLED";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
        {pass.status === "CHECKED_IN" ? <StatusBadge status="CHECKED_IN" /> : pass.status === "CANCELLED" ? <StatusBadge status="CANCELLED" /> : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 ring-1 ring-inset ring-emerald-300">Pass Generated</span>
        )}
      </span>
      {active ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          aria-label={`View pass for ${guest.name}`}
          onClick={() => {
            const tab = window.open("about:blank", "_blank");
            void run(async () => {
              try {
                const url = await link();
                if (tab) tab.location.href = url;
                else window.location.href = url;
              } catch (err) {
                tab?.close();
                throw err;
              }
            }, "Unable to open this pass. Please try again.");
          }}
        >
          View Pass
        </Button>
      ) : null}
      {active ? (
        <Button size="sm" variant="secondary" aria-expanded={sharing} aria-label={`Share pass with ${guest.name}`} onClick={() => setSharing((v) => !v)}>
          Share Pass
        </Button>
      ) : null}
      {editable && pass.status !== "CHECKED_IN" ? (
        <Button size="sm" variant="ghost" disabled={busy} aria-label={`Regenerate pass for ${guest.name}`} onClick={() => setConfirmRegen(true)}>
          Regenerate
        </Button>
      ) : null}
      {sharing ? (
        <div className="flex w-full flex-wrap justify-end gap-1.5" role="group" aria-label={`Share options for ${guest.name}`}>
          <Button
            size="sm"
            variant="gold"
            onClick={() => {
              const tab = window.open("about:blank", "_blank");
              void run(async () => {
                try {
                  const url = await link();
                  const target = whatsAppUrl(passWhatsAppText(event, guest.name, url), guest.phone);
                  if (tab) tab.location.href = target;
                  else window.location.href = target;
                  setSharing(false);
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
                const url = await link();
                onNotice((await copyText(url)) ? `Pass link for ${guest.name} copied.` : url);
                setSharing(false);
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
                  const url = await link();
                  await nativeShare({ title: `Pass for ${guest.name}`, text: passWhatsAppText(event, guest.name, url), url });
                  setSharing(false);
                }, "Unable to share this pass. Please try again.")
              }
            >
              More…
            </Button>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmRegen}
        title={`Regenerate ${guest.name}'s pass?`}
        body="A new QR code and pass link are issued. The old link and QR stop working immediately — share the new pass with the guest."
        confirmLabel="Regenerate"
        busy={busy}
        onCancel={() => setConfirmRegen(false)}
        onConfirm={() =>
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
