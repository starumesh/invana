import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEventTime, type GuestPassView } from "@event-core";
import { PassCard } from "@/components/events/PassCard";
import { CalendarActions } from "@/components/events/ShareActions";
import { ErrorBanner, LoadingBlock } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { copyText, guestPassUrl, nativeShare, publicEventUrl } from "@/lib/eventShare";
import { openInMapsUrl } from "@/lib/maps";
import { downloadPassPng } from "@/lib/passImage";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

export function GuestPassPage() {
  const { token = "" } = useParams();
  const [view, setView] = useState<GuestPassView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    void eventsApi
      .guestPass(token)
      .then((v) => !cancelled && setView(v))
      .catch((err) => !cancelled && setError(errorMessage(err, "This pass could not be loaded. Please try again.")));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <ErrorBanner message={error} />
        <p className="mt-4 text-sm text-ink-muted">If you received this link from the organizer, ask them to resend your pass.</p>
      </main>
    );
  }
  if (!view) return <main className="mx-auto max-w-md px-4 py-16"><LoadingBlock label="Loading your pass…" /></main>;

  const e = view.event;
  const url = guestPassUrl(token);
  const point = { lat: e.latitude, lng: e.longitude };

  return (
    <main className="min-h-screen bg-cream-dark/60 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-sm">
        {view.pass.status === "CHECKED_IN" && view.pass.checkedInAt ? (
          <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900 print:hidden" role="status">
            You checked in at {formatEventTime(view.pass.checkedInAt, e.timezone)}. Enjoy the event!
          </p>
        ) : null}
        {view.pass.status === "CANCELLED" || e.status === "CANCELLED" ? (
          <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-800" role="alert">
            {e.status === "CANCELLED" ? "This event has been cancelled." : "This pass is no longer valid. Contact the organizer."}
          </p>
        ) : null}

        <PassCard view={view} />

        <div className="mt-5 grid grid-cols-3 gap-2 print:hidden">
          <Button
            variant="gold"
            onClick={async () => {
              try {
                await downloadPassPng(view);
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Download failed.");
              }
            }}
          >
            Download
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const shared = await nativeShare({ title: `My pass for ${e.name}`, url });
              if (!shared) setStatus((await copyText(url)) ? "Pass link copied. Only share it with people you trust." : url);
            }}
          >
            Share
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
        <p className="mt-2 min-h-[1.25rem] text-center text-xs text-ink-muted print:hidden" role="status" aria-live="polite">
          {status}
        </p>

        <section className="mt-4 space-y-3 rounded-3xl border border-stone-200 bg-white p-5 print:hidden" aria-label="Plan your visit">
          <h2 className="font-serif text-xl">Add to calendar</h2>
          <CalendarActions
            filename={`${view.pass.publicId}.ics`}
            event={{
              title: e.name,
              description: `Your pass: ${view.pass.publicId}. Show the QR code at the entrance.`,
              location: [e.venueName, e.address, e.city].filter(Boolean).join(", "),
              startIso: e.startDatetime,
              durationMinutes: e.durationMinutes,
              url,
              uid: view.pass.publicId,
            }}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <a href={openInMapsUrl(point, e.venueName)} target="_blank" rel="noreferrer" className={buttonClassName("secondary", "sm")}>
              Open in Maps
            </a>
            {e.slug ? (
              <Link to={`/events/${e.slug}`} className={buttonClassName("ghost", "sm")}>
                Event details
              </Link>
            ) : null}
          </div>
          <p className="text-xs text-ink-muted">
            This pass is personal. Don't post it publicly — anyone with the link can view it. {e.slug ? <>Share <a className="underline" href={publicEventUrl(e.slug)}>the event page</a> instead.</> : null}
          </p>
        </section>
      </div>
    </main>
  );
}
