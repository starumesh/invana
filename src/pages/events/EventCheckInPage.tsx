import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEventDate, formatEventTime, GUEST_ROLE_LABELS, type CheckInResult, type EventStats, type StaffSearchResult } from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { QrScanner } from "@/components/events/QrScanner";
import { ErrorBanner, EventSubNav, LoadingBlock, SignInRequired, StatusBadge } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { errorMessage, eventsApi } from "@/services/eventManagement/client";

type Context = Awaited<ReturnType<typeof eventsApi.checkInContext>>;
type Mode = "scan" | "search" | "manual";

const RESULT_STYLE: Record<CheckInResult["result"], string> = {
  CHECKED_IN: "bg-emerald-600 text-white",
  ALREADY_CHECKED_IN: "bg-amber-400 text-ink",
  INVALID: "bg-red-600 text-white",
  CANCELLED: "bg-red-600 text-white",
  WRONG_EVENT: "bg-red-600 text-white",
  EVENT_NOT_ACTIVE: "bg-stone-700 text-white",
};

const RESULT_ICON: Record<CheckInResult["result"], string> = {
  CHECKED_IN: "✓",
  ALREADY_CHECKED_IN: "!",
  INVALID: "✕",
  CANCELLED: "✕",
  WRONG_EVENT: "✕",
  EVENT_NOT_ACTIVE: "–",
};

export function EventCheckInPage() {
  const { eventId } = useParams();
  const { ready, signedIn } = useAuthSession();
  const [ctx, setCtx] = useState<Context | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("scan");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoContinue, setAutoContinue] = useState(true);
  const [stats, setStats] = useState<EventStats | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);

  const loadContext = useCallback(async () => {
    if (!eventId) return;
    try {
      const c = await eventsApi.checkInContext(eventId);
      setCtx(c);
      setStats(c.stats);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, "You don't have permission to access this event."));
    }
  }, [eventId]);

  useEffect(() => {
    if (ready && signedIn) void loadContext();
  }, [ready, signedIn, loadContext]);

  useEffect(() => {
    if (!result) return;
    resultRef.current?.focus();
    if (result.result === "CHECKED_IN" && autoContinue) {
      const t = setTimeout(() => setResult(null), 2500);
      return () => clearTimeout(t);
    }
  }, [result, autoContinue]);

  const submit = useCallback(
    async (body: { payload?: string; passPublicId?: string; guestId?: string }) => {
      if (!eventId || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const r = await eventsApi.checkIn(eventId, body);
        setResult(r);
        navigator.vibrate?.(r.result === "CHECKED_IN" ? 80 : [60, 60, 60]);
        if (r.result === "CHECKED_IN") {
          setStats((s) => (s ? { ...s, checkedIn: s.checkedIn + 1, notCheckedIn: Math.max(0, s.notCheckedIn - 1) } : s));
        }
      } catch (err) {
        setError(errorMessage(err, "Check-in failed. Please try again."));
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [eventId],
  );

  const onScan = useCallback((text: string) => void submit({ payload: text }), [submit]);

  if (!ready) return <main className="mx-auto max-w-lg px-4 py-10"><LoadingBlock /></main>;
  if (!signedIn) return <SignInRequired />;
  if (loadError) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <ErrorBanner message={loadError} onRetry={() => void loadContext()} />
        <Link to="/events" className="mt-4 inline-block text-sm underline">
          Back to My Invitations
        </Link>
      </main>
    );
  }
  if (!ctx) return <main className="mx-auto max-w-lg px-4 py-10"><LoadingBlock label="Opening check-in…" /></main>;

  const event = ctx.event;
  const closed = event.status !== "PUBLISHED";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-lg flex-col px-4 pb-44 pt-4">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-gold-dark">Check-in · {event.publicId}</p>
        <h1 className="mt-1 font-serif text-2xl leading-tight">{event.name}</h1>
        <p className="text-sm text-ink-muted">
          {formatEventDate(event.startDatetime, event.timezone)} · {formatEventTime(event.startDatetime, event.timezone)} · {event.venueName}
        </p>
        {stats ? (
          <p className="mt-2 text-sm" aria-live="polite">
            <span className="font-semibold tabular-nums text-emerald-700">{stats.checkedIn}</span> checked in ·{" "}
            <span className="tabular-nums">{stats.notCheckedIn}</span> to go · capacity {stats.maxCapacity}
          </p>
        ) : null}
      </header>
      {ctx.access === "ORGANIZER" ? <EventSubNav eventId={event.id} /> : null}

      {closed ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          This event is {event.status.toLowerCase()}. Check-in only records attendance while the event is published.
        </div>
      ) : null}

      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <section className="mt-4" aria-live="assertive">
        {result ? (
          <div
            ref={resultRef}
            tabIndex={-1}
            role="status"
            className={cn("rounded-3xl p-6 text-center shadow-lift outline-none", RESULT_STYLE[result.result])}
          >
            <div aria-hidden className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/25 text-4xl font-bold">
              {RESULT_ICON[result.result]}
            </div>
            <h2 className="mt-3 text-2xl font-semibold">{result.title}</h2>
            <p className="mt-1 text-sm opacity-90">{result.message}</p>
            {result.guest ? (
              <dl className="mt-4 space-y-1 rounded-2xl bg-white/15 p-4 text-left text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="opacity-80">Name</dt>
                  <dd className="text-right text-lg font-semibold">{result.guest.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="opacity-80">Role</dt>
                  <dd>{GUEST_ROLE_LABELS[result.guest.role]}</dd>
                </div>
                {result.event ? (
                  <div className="flex justify-between gap-3">
                    <dt className="opacity-80">Event</dt>
                    <dd className="text-right">{result.event.name}</dd>
                  </div>
                ) : null}
                {result.checkedInAt ? (
                  <div className="flex justify-between gap-3">
                    <dt className="opacity-80">{result.result === "ALREADY_CHECKED_IN" ? "Originally checked in" : "Check-in time"}</dt>
                    <dd className="tabular-nums">{formatEventTime(result.checkedInAt, event.timezone)}</dd>
                  </div>
                ) : null}
                {result.pass ? (
                  <div className="flex justify-between gap-3">
                    <dt className="opacity-80">Pass ID</dt>
                    <dd className="font-mono">{result.pass.publicId}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        ) : mode === "scan" ? (
          <QrScanner active={!result && mode === "scan"} onScan={onScan} />
        ) : null}
      </section>

      {!result && mode === "search" && eventId ? <StaffSearch eventId={eventId} onCheckIn={(guestId) => void submit({ guestId })} busy={busy} /> : null}
      {!result && mode === "manual" ? <ManualEntry onSubmit={(v) => void submit(v)} busy={busy} /> : null}

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
        <input type="checkbox" className="h-4 w-4 accent-[#8c6d45]" checked={autoContinue} onChange={(e) => setAutoContinue(e.target.checked)} />
        Return to scanner automatically after a successful check-in
      </label>

      <nav aria-label="Check-in controls" className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-lg px-4 py-3">
          {result ? (
            <Button className="h-14 w-full text-base" onClick={() => setResult(null)}>
              Scan next guest
            </Button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["scan", "Scan QR"],
                  ["search", "Search"],
                  ["manual", "Pass ID"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-14 rounded-2xl text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-gold/40",
                    mode === m ? "bg-ink text-cream" : "border border-stone-300 bg-white text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
    </main>
  );
}

function StaffSearch({ eventId, onCheckIn, busy }: { eventId: string; onCheckIn: (guestId: string) => void; busy: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StaffSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults(await eventsApi.searchGuests(eventId, q.trim()));
        setError(null);
      } catch (err) {
        setError(errorMessage(err, "Search failed. Please try again."));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, eventId]);

  return (
    <section className="mt-4" aria-label="Search guests">
      <Input
        autoFocus
        type="search"
        aria-label="Search by name, phone, email, or pass ID"
        placeholder="Name, phone, email, or pass ID"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-12 text-base"
      />
      <div className="mt-2">
        <ErrorBanner message={error} />
      </div>
      {results ? (
        <ul className="mt-2 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white" aria-live="polite">
          {results.map((r) => (
            <li key={r.guestId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-ink-muted">
                  {GUEST_ROLE_LABELS[r.role]} · {[r.maskedPhone, r.maskedEmail, r.passPublicId].filter(Boolean).join(" · ")}
                </p>
              </div>
              {r.passStatus === "ISSUED" ? (
                <Button size="sm" onClick={() => onCheckIn(r.guestId)} disabled={busy} aria-label={`Check in ${r.name}`}>
                  Check in
                </Button>
              ) : (
                <StatusBadge status={r.passStatus ?? "NO_PASS"} />
              )}
            </li>
          ))}
          {!results.length ? <li className="px-4 py-6 text-center text-sm text-ink-muted">No guests match.</li> : null}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink-muted">Type at least 2 characters. Contact details are masked for privacy.</p>
      )}
    </section>
  );
}

function ManualEntry({ onSubmit, busy }: { onSubmit: (v: { payload?: string; passPublicId?: string }) => void; busy: boolean }) {
  const [value, setValue] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onSubmit(v.startsWith("{") || v.includes("/pass/") ? { payload: v } : { passPublicId: v });
    setValue("");
  }
  return (
    <form onSubmit={submit} className="mt-4 space-y-2" aria-label="Enter pass ID">
      <Input
        autoFocus
        aria-label="Pass ID or scanned code"
        placeholder="INV-PASS-XXXXXXXX"
        autoCapitalize="characters"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-12 font-mono text-base"
      />
      <Button type="submit" className="h-12 w-full" disabled={busy || !value.trim()}>
        Verify & check in
      </Button>
      <p className="text-xs text-ink-muted">Works with the pass ID printed under the QR code, or a USB/Bluetooth barcode scanner.</p>
    </form>
  );
}
