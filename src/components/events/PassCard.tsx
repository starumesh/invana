import { useEffect, useState } from "react";
import { formatDuration, formatEventDate, formatEventTime, GUEST_ROLE_LABELS, type GuestPassView } from "@event-core";
import { qrMatrix, qrSvg } from "@/lib/qr";
import { StatusBadge } from "@/components/events/ui";

export function QrCode({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let cancelled = false;
    void qrMatrix(value).then((m) => {
      if (!cancelled) setSvg(qrSvg(m, size));
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);
  return (
    <div
      role="img"
      aria-label={label}
      className="mx-auto rounded-2xl bg-white p-2"
      style={{ width: size + 16, height: size + 16 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Branded, printable pass. Every QR fact is also rendered as text. */
export function PassCard({ view }: { view: GuestPassView }) {
  const e = view.event;
  const date = formatEventDate(e.startDatetime, e.timezone);
  const time = formatEventTime(e.startDatetime, e.timezone);
  const venue = [e.venueName, e.address, e.city].filter(Boolean).join(", ");
  const inactive = view.pass.status === "CANCELLED" || e.status === "CANCELLED";
  return (
    <article
      aria-labelledby="pass-event-name"
      className="pass-card mx-auto w-full max-w-sm overflow-hidden rounded-[28px] border border-stone-200 bg-cream shadow-lift print:shadow-none"
    >
      <header className="bg-ink px-6 pb-6 pt-5 text-cream">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-gold-light">Invana · Event pass</p>
        <h1 id="pass-event-name" className="mt-3 font-serif text-3xl leading-tight">
          {e.name}
        </h1>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-cream/60">Date</dt>
            <dd className="font-medium">{date}</dd>
          </div>
          <div>
            <dt className="text-cream/60">Time</dt>
            <dd className="font-medium">
              {time} · {formatDuration(e.durationMinutes)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-cream/60">Venue</dt>
            <dd className="font-medium">{venue}</dd>
          </div>
        </dl>
      </header>
      <div className="px-6 pb-6 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold-dark">Guest</p>
            <p className="truncate text-xl font-semibold">{view.guest.name}</p>
          </div>
          <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-sm font-semibold text-ink">{GUEST_ROLE_LABELS[view.guest.role]}</span>
        </div>
        <div className={inactive ? "mt-5 opacity-30 grayscale" : "mt-5"}>
          <QrCode
            value={view.qrPayload}
            size={232}
            label={`Entry QR code for ${view.guest.name}, pass ${view.pass.publicId}. Staff can also check in using the pass ID.`}
          />
        </div>
        <p className="mt-4 text-center font-mono text-lg font-semibold tracking-wider" aria-label={`Pass ID ${view.pass.publicId.split("").join(" ")}`}>
          {view.pass.publicId}
        </p>
        <p className="mt-1 text-center text-sm text-ink-muted">Show this pass at entrance</p>
        <div className="mt-4 flex justify-center">
          {e.status === "CANCELLED" ? (
            <StatusBadge status="CANCELLED" />
          ) : (
            <StatusBadge status={view.pass.status} />
          )}
        </div>
      </div>
    </article>
  );
}
