import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  formatDuration,
  formatEventDate,
  formatEventTime,
  GUEST_ROLE_LABELS,
  timelineTimeToIso,
  utcToZoned,
  validateCapacity,
  validateEventDetails,
  validateTimeline,
  zonedToUtcIso,
  type EventDetailsInput,
  type FieldErrors,
  type GuestValue,
} from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { CsvImport, GuestForm, type GuestDraft } from "@/components/events/GuestForms";
import { TileMap } from "@/components/events/TileMap";
import { ErrorBanner, FormField, LoadingBlock, Notice, PageTitle, SignInRequired } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { EVENT_TYPE_OPTIONS, templateFor } from "@/config/event-templates";
import { cn } from "@/lib/cn";
import { mapProvider, openInMapsUrl, type GeocodeResult } from "@/lib/maps";
import { EVENT_MAX_CAPACITY, EmApiError, errorMessage, eventsApi } from "@/services/eventManagement/client";

type TimelineDraft = { key: string; start: string; end: string; title: string; description: string; location: string };

type WizardDraft = {
  name: string;
  description: string;
  eventType: string;
  date: string;
  startTime: string;
  timezone: string;
  durationHours: string;
  durationMins: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  maxCapacity: string;
  showGuestBios: boolean;
  showSpeakers: boolean;
  timeline: TimelineDraft[];
  guests: (GuestDraft & { key: string })[];
};

const AUTOSAVE_KEY = "invana.em.wizard.v1";
const STEPS = ["Details", "Venue", "Capacity", "Timeline", "Guests", "Review"] as const;
type Step = (typeof STEPS)[number];
const STEP_FIELDS: Record<Step, string[]> = {
  Details: ["name", "description", "eventType", "date", "startTime", "timezone", "durationMinutes"],
  Venue: ["venueName", "address", "city", "state", "country", "location"],
  Capacity: ["maxCapacity"],
  Timeline: [],
  Guests: [],
  Review: [],
};

const localTz = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

const TIMEZONES = Array.from(new Set([localTz, "Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"]));

const key = () => Math.random().toString(36).slice(2, 10);

function emptyDraft(): WizardDraft {
  const d = new Date(Date.now() + 30 * 86400_000);
  return {
    name: "",
    description: "",
    eventType: "Wedding",
    date: d.toISOString().slice(0, 10),
    startTime: "18:00",
    timezone: localTz,
    durationHours: "4",
    durationMins: "0",
    venueName: "",
    address: "",
    city: "",
    state: "",
    country: "",
    latitude: null,
    longitude: null,
    maxCapacity: "100",
    showGuestBios: false,
    showSpeakers: true,
    timeline: [],
    guests: [],
  };
}

function durationOf(d: WizardDraft): number {
  return (Number(d.durationHours) || 0) * 60 + (Number(d.durationMins) || 0);
}

function detailsInput(d: WizardDraft): EventDetailsInput {
  return {
    name: d.name,
    description: d.description,
    eventType: d.eventType,
    date: d.date,
    startTime: d.startTime,
    timezone: d.timezone,
    durationMinutes: durationOf(d),
    venueName: d.venueName,
    address: d.address,
    city: d.city,
    state: d.state,
    country: d.country,
    latitude: d.latitude ?? undefined,
    longitude: d.longitude ?? undefined,
    maxCapacity: d.maxCapacity === "" ? "" : Number(d.maxCapacity),
    showGuestBios: d.showGuestBios,
    showSpeakers: d.showSpeakers,
  };
}

function timelineInput(d: WizardDraft) {
  const start = zonedToUtcIso(d.date, d.startTime, d.timezone);
  return d.timeline.map((t) => ({
    title: t.title,
    description: t.description,
    location: t.location,
    startTime: start && t.start ? timelineTimeToIso(start, d.timezone, t.start) : "",
    endTime: start && t.end ? timelineTimeToIso(start, d.timezone, t.end) : "",
  }));
}

function addMinutesHHmm(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function EventWizardPage() {
  const { eventId } = useParams();
  const editing = Boolean(eventId);
  const steps = useMemo(() => (editing ? STEPS.filter((s) => s !== "Guests") : [...STEPS]), [editing]);
  const { ready, signedIn } = useAuthSession();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [timelineErrors, setTimelineErrors] = useState<FieldErrors[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [guestPanel, setGuestPanel] = useState<"single" | "csv">("single");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = steps[stepIndex];

  // Load existing event (edit) or restore autosave (create).
  useEffect(() => {
    if (!ready || !signedIn) return;
    if (!editing) {
      try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { draft: WizardDraft; at: string };
          setDraft({ ...emptyDraft(), ...saved.draft });
          setRestoredAt(saved.at);
        }
      } catch {
        /* ignore corrupt autosave */
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const detail = await eventsApi.get(eventId!);
        if (cancelled) return;
        const e = detail.event;
        const local = utcToZoned(e.startDatetime, e.timezone);
        setDraft({
          ...emptyDraft(),
          name: e.name,
          description: e.description,
          eventType: e.eventType,
          date: local.date,
          startTime: local.time,
          timezone: e.timezone,
          durationHours: String(Math.floor(e.durationMinutes / 60)),
          durationMins: String(e.durationMinutes % 60),
          venueName: e.venueName,
          address: e.address,
          city: e.city,
          state: e.state,
          country: e.country,
          latitude: e.latitude,
          longitude: e.longitude,
          maxCapacity: String(e.maxCapacity),
          showGuestBios: e.showGuestBios,
          showSpeakers: e.showSpeakers,
          timeline: detail.timeline.map((t) => ({
            key: t.id,
            start: utcToZoned(t.startTime, e.timezone).time,
            end: utcToZoned(t.endTime, e.timezone).time,
            title: t.title,
            description: t.description,
            location: t.location,
          })),
        });
      } catch (err) {
        if (!cancelled) setBanner(errorMessage(err, "Unable to load this event. Please try again."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, signedIn, editing, eventId]);

  // Auto-save (create mode) — local, debounced.
  useEffect(() => {
    if (editing || loading) return;
    const t = setTimeout(() => {
      if (!draft.name && !draft.venueName && !draft.guests.length) return;
      const at = new Date().toISOString();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ draft, at }));
      setSavedAt(at);
    }, 600);
    return () => clearTimeout(t);
  }, [draft, editing, loading]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, [stepIndex]);

  const update = useCallback(<K extends keyof WizardDraft>(k: K, v: WizardDraft[K]) => setDraft((d) => ({ ...d, [k]: v })), []);

  const capacityNum = Number(draft.maxCapacity) || 0;

  function validateStep(s: Step): boolean {
    const all = validateEventDetails(detailsInput(draft), { maxCapacityLimit: EVENT_MAX_CAPACITY, requireFuture: !editing });
    const fieldErrors = all.ok ? {} : all.errors;
    if (s === "Review") {
      for (const other of steps.slice(0, -1)) if (!validateStep(other)) return false;
      return true;
    }
    const mine: FieldErrors = {};
    for (const f of STEP_FIELDS[s]) if (fieldErrors[f]) mine[f] = fieldErrors[f];
    if (s === "Capacity" && !mine.maxCapacity && draft.guests.length > capacityNum) {
      mine.maxCapacity = `You've added ${draft.guests.length} guests — capacity must be at least that.`;
    }
    if (s === "Timeline") {
      const start = zonedToUtcIso(draft.date, draft.startTime, draft.timezone);
      if (start) {
        const tl = validateTimeline(timelineInput(draft), { startDatetime: start, durationMinutes: durationOf(draft) });
        setTimelineErrors(tl.ok ? [] : tl.errors);
        if (!tl.ok) {
          setStepIndex(steps.indexOf("Timeline"));
          return false;
        }
      }
    }
    if (s === "Guests" && draft.guests.length > capacityNum) {
      setBanner("Maximum event capacity has been reached.");
      setStepIndex(steps.indexOf(s));
      return false;
    }
    setErrors((prev) => {
      const next = { ...prev };
      for (const f of STEP_FIELDS[s]) delete next[f];
      return { ...next, ...mine };
    });
    if (Object.keys(mine).length) {
      setStepIndex(steps.indexOf(s));
      return false;
    }
    return true;
  }

  function next() {
    setBanner(null);
    if (!validateStep(step)) return;
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }

  function back() {
    setBanner(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function applyServerError(err: unknown, fallback: string) {
    if (err instanceof EmApiError && err.fieldErrors) {
      setErrors(err.fieldErrors);
      const first = steps.find((s) => STEP_FIELDS[s].some((f) => err.fieldErrors?.[f]));
      if (first) setStepIndex(steps.indexOf(first));
    }
    if (err instanceof EmApiError && Array.isArray(err.details?.timeline)) {
      setTimelineErrors(err.details!.timeline as FieldErrors[]);
      setStepIndex(steps.indexOf("Timeline"));
    }
    setBanner(errorMessage(err, fallback));
  }

  async function save(mode: "draft" | "create") {
    setBanner(null);
    if (!validateStep("Review")) {
      setBanner(editing ? "Unable to update the event. Please check the required fields." : "Unable to create the event. Please check the required fields.");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await eventsApi.update(eventId!, { details: detailsInput(draft), timeline: timelineInput(draft) });
        navigate(`/events/${eventId}/manage`, { state: { notice: "Event updated." } });
        return;
      }
      const created = await eventsApi.create({
        details: detailsInput(draft),
        timeline: timelineInput(draft),
        guests: draft.guests.map(({ key: _k, ...g }) => g),
      });
      localStorage.removeItem(AUTOSAVE_KEY);
      const id = created.event.id;
      if (mode === "create" && created.guests.length) {
        navigate(`/events/${id}/guests`, {
          state: {
            notice: `Event created with ${created.guests.length} guest${created.guests.length === 1 ? "" : "s"}. Select guests and choose Generate passes when you're ready.`,
          },
        });
        return;
      }
      navigate(`/events/${id}/manage`, {
        state: {
          notice:
            mode === "create"
              ? "Event created. Add guests, then generate passes for the ones you select."
              : "Draft saved. You can keep editing, add guests, and publish later.",
        },
      });
    } catch (err) {
      applyServerError(err, editing ? "Unable to update the event. Please check the required fields." : "Unable to create the event. Please check the required fields.");
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate() {
    const tpl = templateFor(draft.eventType);
    setDraft((d) => ({
      ...d,
      description: d.description || tpl.descriptionHint,
      durationHours: String(Math.floor(tpl.durationMinutes / 60)),
      durationMins: String(tpl.durationMinutes % 60),
      timeline: tpl.timeline.map((t) => ({
        key: key(),
        start: addMinutesHHmm(d.startTime, t.offsetMinutes),
        end: addMinutesHHmm(d.startTime, t.offsetMinutes + t.durationMinutes),
        title: t.title,
        description: t.description ?? "",
        location: "",
      })),
    }));
  }

  if (!ready) return <main className="mx-auto max-w-4xl px-4 py-12"><LoadingBlock /></main>;
  if (!signedIn) return <SignInRequired />;
  if (loading) return <main className="mx-auto max-w-4xl px-4 py-12"><LoadingBlock label="Loading event…" /></main>;

  const startIso = zonedToUtcIso(draft.date, draft.startTime, draft.timezone);
  const point = draft.latitude !== null && draft.longitude !== null ? { lat: draft.latitude, lng: draft.longitude } : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 pb-32">
      <PageTitle eyebrow={editing ? "Edit event" : "New event"} title={editing ? draft.name || "Edit event" : "Create an event"}>
        <Link to={editing ? `/events/${eventId}/manage` : "/events"} className={buttonClassName("ghost", "sm")}>
          Cancel
        </Link>
      </PageTitle>

      <ol className="mt-8 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => (i < stepIndex ? setStepIndex(i) : undefined)}
              aria-current={i === stepIndex ? "step" : undefined}
              disabled={i > stepIndex}
              className={cn(
                "w-full rounded-full border px-3 py-2 font-medium transition focus:outline-none focus-visible:ring-4 focus-visible:ring-gold/40",
                i === stepIndex && "border-ink bg-ink text-cream",
                i < stepIndex && "border-gold/60 bg-white text-ink hover:border-gold",
                i > stepIndex && "border-stone-200 bg-white/60 text-ink-faint",
              )}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      {restoredAt && !editing ? (
        <div className="mt-6">
          <Notice>
            Restored your unsaved draft from {new Date(restoredAt).toLocaleString()}.{" "}
            <button
              type="button"
              className="font-medium text-ink underline"
              onClick={() => {
                localStorage.removeItem(AUTOSAVE_KEY);
                setDraft(emptyDraft());
                setRestoredAt(null);
                setStepIndex(0);
              }}
            >
              Start over
            </button>
          </Notice>
        </div>
      ) : null}

      <div className="mt-6">
        <ErrorBanner message={banner} />
      </div>

      <section aria-labelledby="step-heading" className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none">
          {step === "Details" && "Event details"}
          {step === "Venue" && "Venue & map"}
          {step === "Capacity" && "Capacity"}
          {step === "Timeline" && "Timeline"}
          {step === "Guests" && "Guests"}
          {step === "Review" && "Review"}
        </h2>

        {step === "Details" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <FormField label="Event name" required error={errors.name} className="sm:col-span-2">
              {(p) => <Input {...p} value={draft.name} onChange={(e) => update("name", e.target.value)} maxLength={120} />}
            </FormField>
            <FormField label="Event type" required error={errors.eventType}>
              {(p) => (
                <Select {...p} value={draft.eventType} onChange={(e) => update("eventType", e.target.value)}>
                  {EVENT_TYPE_OPTIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              )}
            </FormField>
            <div className="flex items-end">
              <Button type="button" variant="secondary" size="sm" onClick={applyTemplate}>
                Use {draft.eventType} template
              </Button>
            </div>
            <FormField label="Description" required error={errors.description} className="sm:col-span-2">
              {(p) => (
                <Textarea {...p} value={draft.description} onChange={(e) => update("description", e.target.value)} placeholder={templateFor(draft.eventType).descriptionHint} maxLength={5000} />
              )}
            </FormField>
            <FormField label="Date" required error={errors.date}>
              {(p) => <Input {...p} type="date" value={draft.date} onChange={(e) => update("date", e.target.value)} />}
            </FormField>
            <FormField label="Start time" required error={errors.startTime}>
              {(p) => <Input {...p} type="time" value={draft.startTime} onChange={(e) => update("startTime", e.target.value)} />}
            </FormField>
            <FormField label="Duration" required error={errors.durationMinutes} hint={durationOf(draft) > 0 ? formatDuration(durationOf(draft)) : undefined}>
              {(p) => (
                <div className="flex items-center gap-2">
                  <Input {...p} type="number" min={0} inputMode="numeric" aria-label="Duration hours" value={draft.durationHours} onChange={(e) => update("durationHours", e.target.value)} />
                  <span className="text-sm text-ink-muted">hrs</span>
                  <Select aria-label="Duration minutes" value={draft.durationMins} onChange={(e) => update("durationMins", e.target.value)}>
                    {["0", "15", "30", "45"].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </FormField>
            <FormField label="Time zone" error={errors.timezone}>
              {(p) => (
                <Select {...p} value={draft.timezone} onChange={(e) => update("timezone", e.target.value)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz}>{tz}</option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
        ) : null}

        {step === "Venue" ? <VenueStep draft={draft} update={update} errors={errors} point={point} /> : null}

        {step === "Capacity" ? (
          <div className="mt-6 max-w-sm space-y-4">
            <FormField label="Maximum attendees" required error={errors.maxCapacity} hint={`Whole number from 1 to ${EVENT_MAX_CAPACITY.toLocaleString()}.`}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={1}
                  max={EVENT_MAX_CAPACITY}
                  step={1}
                  inputMode="numeric"
                  value={draft.maxCapacity}
                  onChange={(e) => {
                    update("maxCapacity", e.target.value);
                    const msg = validateCapacity(e.target.value, EVENT_MAX_CAPACITY);
                    setErrors((prev) => ({ ...prev, maxCapacity: msg ?? "" }));
                  }}
                />
              )}
            </FormField>
            {!validateCapacity(draft.maxCapacity, EVENT_MAX_CAPACITY) ? (
              <p className="font-serif text-xl" aria-live="polite">
                Maximum capacity: {capacityNum.toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === "Timeline" ? <TimelineStep draft={draft} setDraft={setDraft} errors={timelineErrors} onTemplate={applyTemplate} /> : null}

        {step === "Guests" ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-ink-muted" aria-live="polite">
              {draft.guests.length} / {capacityNum.toLocaleString()} guests · after creating the event, select guests and generate their passes.
            </p>
            <div className="flex gap-2" role="tablist" aria-label="Add guests">
              {(["single", "csv"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={guestPanel === t}
                  type="button"
                  onClick={() => setGuestPanel(t)}
                  className={cn("rounded-full px-4 py-2 text-sm", guestPanel === t ? "bg-ink text-cream" : "border border-stone-300 bg-white")}
                >
                  {t === "single" ? "Add a guest" : "Import CSV"}
                </button>
              ))}
            </div>
            {guestPanel === "single" ? (
              <GuestForm
                submitLabel="Add guest"
                onSubmit={(g: GuestValue) => {
                  const dup = draft.guests.some(
                    (x) => (g.email && x.email.toLowerCase() === g.email) || (g.phone && x.phone.replace(/\D/g, "") === g.phone.replace(/\D/g, "")) || (!g.email && !g.phone && x.name.toLowerCase() === g.name.toLowerCase()),
                  );
                  if (dup) {
                    setBanner("This guest is already registered for this event.");
                    return false;
                  }
                  if (draft.guests.length >= capacityNum) {
                    setBanner("Maximum event capacity has been reached.");
                    return false;
                  }
                  setBanner(null);
                  setDraft((d) => ({ ...d, guests: [...d.guests, { ...g, key: key() }] }));
                }}
              />
            ) : (
              <CsvImport
                existing={draft.guests}
                remainingCapacity={capacityNum - draft.guests.length}
                onImport={(rows) => setDraft((d) => ({ ...d, guests: [...d.guests, ...rows.map((g) => ({ ...g, key: key() }))] }))}
              />
            )}
            {draft.guests.length ? (
              <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200">
                {draft.guests.map((g) => (
                  <li key={g.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{g.name}</span>{" "}
                      <span className="text-ink-muted">· {GUEST_ROLE_LABELS[g.role]}</span>
                      <span className="block truncate text-xs text-ink-muted">{[g.email, g.phone].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${g.name}`} onClick={() => setDraft((d) => ({ ...d, guests: d.guests.filter((x) => x.key !== g.key) }))}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">No guests yet. You can also add guests after creating the event.</p>
            )}
          </div>
        ) : null}

        {step === "Review" ? (
          <div className="mt-6 space-y-6 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReviewItem label="Name" value={draft.name} />
              <ReviewItem label="Type" value={draft.eventType} />
              <ReviewItem label="Description" value={draft.description} wide />
              <ReviewItem label="Date" value={startIso ? formatEventDate(startIso, draft.timezone) : draft.date} />
              <ReviewItem label="Time" value={startIso ? `${formatEventTime(startIso, draft.timezone)} (${draft.timezone})` : draft.startTime} />
              <ReviewItem label="Duration" value={formatDuration(durationOf(draft))} />
              <ReviewItem label="Capacity" value={`Maximum capacity: ${capacityNum.toLocaleString()}`} />
              <ReviewItem label="Venue" value={[draft.venueName, draft.address, draft.city, draft.state, draft.country].filter(Boolean).join(", ")} wide />
            </dl>
            {point ? (
              <div>
                <TileMap value={point} label="Venue location" height={200} />
                <a className="mt-2 inline-block text-sm font-medium text-gold-dark underline" href={openInMapsUrl(point, draft.venueName)} target="_blank" rel="noreferrer">
                  Open in Maps
                </a>
              </div>
            ) : null}
            <div>
              <h3 className="font-medium">Timeline ({draft.timeline.length})</h3>
              {draft.timeline.length ? (
                <ol className="mt-2 space-y-1">
                  {draft.timeline.map((t) => (
                    <li key={t.key}>
                      <span className="tabular-nums text-ink-muted">
                        {t.start}–{t.end}
                      </span>{" "}
                      {t.title}
                      {t.location ? <span className="text-ink-muted"> · {t.location}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-ink-muted">No timeline entries.</p>
              )}
            </div>
            {!editing ? (
              <div>
                <h3 className="font-medium">Guests ({draft.guests.length})</h3>
                {draft.guests.length ? (
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {draft.guests.slice(0, 50).map((g) => (
                      <li key={g.key}>
                        {g.name} <span className="text-ink-muted">· {GUEST_ROLE_LABELS[g.role]} · Invited</span>
                      </li>
                    ))}
                    {draft.guests.length > 50 ? <li className="text-ink-muted">…and {draft.guests.length - 50} more</li> : null}
                  </ul>
                ) : (
                  <p className="text-ink-muted">No guests yet.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-xs text-ink-muted" aria-live="polite">
            {!editing && savedAt ? `Auto-saved on this device · ${new Date(savedAt).toLocaleTimeString()}` : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            {stepIndex > 0 ? (
              <Button type="button" variant="secondary" onClick={back} disabled={busy}>
                Back
              </Button>
            ) : null}
            {step === "Review" ? (
              editing ? (
                <Button type="button" variant="gold" onClick={() => void save("draft")} disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={() => void save("draft")} disabled={busy}>
                    Save Draft
                  </Button>
                  <Button type="button" variant="gold" onClick={() => void save("create")} disabled={busy}>
                    {busy ? "Creating…" : "Create Event"}
                  </Button>
                </>
              )
            ) : (
              <Button type="button" variant="gold" onClick={next}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function ReviewItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-[0.14em] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line">{value || "—"}</dd>
    </div>
  );
}

function VenueStep({
  draft,
  update,
  errors,
  point,
}: {
  draft: WizardDraft;
  update: <K extends keyof WizardDraft>(k: K, v: WizardDraft[K]) => void;
  errors: FieldErrors;
  point: { lat: number; lng: number } | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function search() {
    const q = query.trim() || [draft.venueName, draft.address, draft.city, draft.country].filter(Boolean).join(", ");
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const rows = await mapProvider.geocode(q);
      setResults(rows);
      if (!rows.length) setSearchError("No matches. Try a shorter address, or tap the map to drop the pin.");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Address search failed.");
    } finally {
      setSearching(false);
    }
  }

  function pick(r: GeocodeResult) {
    update("latitude", r.lat);
    update("longitude", r.lng);
    if (!draft.city && r.city) update("city", r.city);
    if (!draft.state && r.state) update("state", r.state);
    if (!draft.country && r.country) update("country", r.country);
    if (!draft.address) update("address", r.label);
    setResults([]);
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <FormField label="Venue name" required error={errors.venueName} className="sm:col-span-2">
        {(p) => <Input {...p} value={draft.venueName} onChange={(e) => update("venueName", e.target.value)} />}
      </FormField>
      <FormField label="Address" required error={errors.address} className="sm:col-span-2">
        {(p) => <Input {...p} value={draft.address} onChange={(e) => update("address", e.target.value)} autoComplete="street-address" />}
      </FormField>
      <FormField label="City" required error={errors.city}>
        {(p) => <Input {...p} value={draft.city} onChange={(e) => update("city", e.target.value)} autoComplete="address-level2" />}
      </FormField>
      <FormField label="State" error={errors.state}>
        {(p) => <Input {...p} value={draft.state} onChange={(e) => update("state", e.target.value)} autoComplete="address-level1" />}
      </FormField>
      <FormField label="Country" required error={errors.country}>
        {(p) => <Input {...p} value={draft.country} onChange={(e) => update("country", e.target.value)} autoComplete="country-name" />}
      </FormField>
      <div className="sm:col-span-2">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
          Map pin <span className="text-gold-dark">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Search address for the map pin"
            className="min-w-0 flex-1"
            placeholder="Search address (or leave empty to use the venue fields)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => void search()} disabled={searching}>
            {searching ? "Searching…" : "Find on map"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition(
                (pos) => {
                  update("latitude", Math.round(pos.coords.latitude * 1e6) / 1e6);
                  update("longitude", Math.round(pos.coords.longitude * 1e6) / 1e6);
                },
                () => setSearchError("Location permission was denied. Search or tap the map instead."),
              )
            }
          >
            Use my location
          </Button>
        </div>
        {searchError ? <p className="mt-2 text-xs text-amber-800">{searchError}</p> : null}
        {results.length ? (
          <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm" aria-label="Address results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-cream focus:bg-cream focus:outline-none" onClick={() => pick(r)}>
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3">
          <TileMap
            value={point}
            label="Venue map"
            onChange={(p) => {
              update("latitude", p.lat);
              update("longitude", p.lng);
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          {point ? (
            <>
              <span className="tabular-nums">
                Pinned at {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </span>
              <a className="font-medium text-gold-dark underline" href={openInMapsUrl(point, draft.venueName)} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
            </>
          ) : (
            <span>Tap the map to drop the pin at the entrance.</span>
          )}
        </div>
        {errors.location ? <p className="mt-1 text-xs font-medium text-red-700" role="alert">{errors.location}</p> : null}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-muted">Enter coordinates manually</summary>
          <div className="mt-2 grid max-w-md grid-cols-2 gap-2">
            <Input aria-label="Latitude" type="number" step="any" value={draft.latitude ?? ""} onChange={(e) => update("latitude", e.target.value === "" ? null : Number(e.target.value))} />
            <Input aria-label="Longitude" type="number" step="any" value={draft.longitude ?? ""} onChange={(e) => update("longitude", e.target.value === "" ? null : Number(e.target.value))} />
          </div>
        </details>
      </div>
      <fieldset className="space-y-2 text-sm sm:col-span-2">
        <legend className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Public page</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.showSpeakers} onChange={(e) => update("showSpeakers", e.target.checked)} className="h-4 w-4 accent-[#8c6d45]" />
          Show speakers and hosts on the public page
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.showGuestBios} onChange={(e) => update("showGuestBios", e.target.checked)} className="h-4 w-4 accent-[#8c6d45]" />
          Show their bios publicly
        </label>
      </fieldset>
    </div>
  );
}

function TimelineStep({
  draft,
  setDraft,
  errors,
  onTemplate,
}: {
  draft: WizardDraft;
  setDraft: Dispatch<SetStateAction<WizardDraft>>;
  errors: FieldErrors[];
  onTemplate: () => void;
}) {
  const end = addMinutesHHmm(draft.startTime, durationOf(draft));
  const setItem = (k: string, patch: Partial<TimelineDraft>) =>
    setDraft((d) => ({ ...d, timeline: d.timeline.map((t) => (t.key === k ? { ...t, ...patch } : t)) }));
  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const list = [...d.timeline];
      const target = index + dir;
      if (target < 0 || target >= list.length) return d;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...d, timeline: list };
    });

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-ink-muted">
        Entries must fall between {draft.startTime} and {end} ({formatDuration(durationOf(draft))}). Times after midnight roll into the next day.
      </p>
      <ol className="space-y-3">
        {draft.timeline.map((t, i) => {
          const e = errors[i] ?? {};
          return (
            <li key={t.key} className="rounded-2xl border border-stone-200 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
                <FormField label="Start" required error={e.startTime}>
                  {(p) => <Input {...p} type="time" value={t.start} onChange={(ev) => setItem(t.key, { start: ev.target.value })} />}
                </FormField>
                <FormField label="End" required error={e.endTime}>
                  {(p) => <Input {...p} type="time" value={t.end} onChange={(ev) => setItem(t.key, { end: ev.target.value })} />}
                </FormField>
                <FormField label="Title" required error={e.title}>
                  {(p) => <Input {...p} value={t.title} onChange={(ev) => setItem(t.key, { title: ev.target.value })} />}
                </FormField>
                <FormField label="Description" error={e.description} className="sm:col-span-2">
                  {(p) => <Input {...p} value={t.description} onChange={(ev) => setItem(t.key, { description: ev.target.value })} />}
                </FormField>
                <FormField label="Location" hint="Optional" error={e.location}>
                  {(p) => <Input {...p} value={t.location} onChange={(ev) => setItem(t.key, { location: ev.target.value })} />}
                </FormField>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${t.title || "entry"} up`}>
                  ↑ Up
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === draft.timeline.length - 1} aria-label={`Move ${t.title || "entry"} down`}>
                  ↓ Down
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, timeline: d.timeline.filter((x) => x.key !== t.key) }))} aria-label={`Delete ${t.title || "entry"}`}>
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setDraft((d) => {
              const last = d.timeline[d.timeline.length - 1];
              const start = last?.end || d.startTime;
              return { ...d, timeline: [...d.timeline, { key: key(), start, end: addMinutesHHmm(start, 60), title: "", description: "", location: "" }] };
            })
          }
        >
          + Add entry
        </Button>
        {!draft.timeline.length ? (
          <Button type="button" variant="ghost" size="sm" onClick={onTemplate}>
            Start from the {draft.eventType} template
          </Button>
        ) : null}
      </div>
    </div>
  );
}
