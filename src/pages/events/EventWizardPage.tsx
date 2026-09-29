import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  formatDuration,
  formatEventDate,
  GUEST_ROLE_LABELS,
  timelineTimeToIso,
  utcToZoned,
  validateCapacity,
  validateEventDetails,
  validateTimeline,
  zonedToUtcIso,
  type EventDetail,
  type EventDetailsInput,
  type FieldErrors,
  type GuestWithPass,
} from "@event-core";
import { useAuthSession } from "@/auth/AuthSession";
import { CsvImport, GuestForm } from "@/components/events/GuestForms";
import { LocationMap } from "@/components/events/LocationMap";
import { PassActions } from "@/components/events/PassActions";
import { ConfirmDialog, ErrorBanner, FormField, LoadingBlock, Notice, PageTitle, SignInRequired } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { TimeInput } from "@/components/ui/TimeInput";
import { categoryOf, EVENT_CATEGORIES, templateFor } from "@/config/event-templates";
import { cn } from "@/lib/cn";
import { isValidLatLng, mapProvider, openInMapsUrl, parseLocationInput, round6, type GeocodeResult, type LatLng } from "@/lib/maps";
import { formatTime12 } from "@/lib/time12";
import { EVENT_MAX_CAPACITY, EmApiError, errorMessage, eventsApi } from "@/services/eventManagement/client";

type TimelineDraft = { key: string; start: string; end: string; title: string; description: string; location: string };

/**
 * The one canonical invitation draft. Every step reads and writes this object; it is
 * auto-saved on this device (so a refresh keeps everything) and mirrored to the server
 * draft event from the Guests step on. Guests themselves live only on the server
 * (keyed by `eventId`), so the wizard and the event's Guests page show the same list.
 */
type WizardDraft = {
  eventId: string | null;
  name: string;
  description: string;
  categoryId: string;
  eventType: string;
  customType: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Only set for events longer than a day (loaded from the server). */
  durationOverride: number | null;
  timezone: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
  mapUrl: string;
  maxCapacity: string;
  showGuestBios: boolean;
  showSpeakers: boolean;
  timeline: TimelineDraft[];
};

const AUTOSAVE_KEY = "invana.em.wizard.v2";
const STEPS = ["Details", "Date & Time", "Venue & Map", "Timeline", "Guests", "Review"] as const;
type Step = (typeof STEPS)[number];
const STEP_FIELDS: Record<Step, string[]> = {
  Details: ["name", "description", "eventType"],
  "Date & Time": ["date", "startTime", "endTime", "timezone", "durationMinutes"],
  "Venue & Map": ["venueName", "address", "city", "state", "country", "location", "maxCapacity"],
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

const TIMEZONES = Array.from(
  new Set([localTz, "Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"]),
);

const newKey = () => Math.random().toString(36).slice(2, 10);

function emptyDraft(): WizardDraft {
  return {
    eventId: null,
    name: "",
    description: "",
    categoryId: EVENT_CATEGORIES[0].id,
    eventType: EVENT_CATEGORIES[0].types[0],
    customType: "",
    date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    startTime: "18:00",
    endTime: "22:00",
    durationOverride: null,
    timezone: localTz,
    venueName: "",
    address: "",
    city: "",
    state: "",
    country: "",
    latitude: null,
    longitude: null,
    locationConfirmed: false,
    mapUrl: "",
    maxCapacity: "",
    showGuestBios: false,
    showSpeakers: true,
    timeline: [],
  };
}

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function durationOf(d: WizardDraft): number {
  if (d.durationOverride) return d.durationOverride;
  const s = minutesOf(d.startTime);
  const e = minutesOf(d.endTime);
  if (s === null || e === null) return 0;
  const diff = e - s;
  return diff > 0 ? diff : diff + 1440;
}

function addMinutesHHmm(hhmm: string, minutes: number): string {
  const base = minutesOf(hhmm) ?? 0;
  const total = (((base + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function effectiveType(d: WizardDraft): string {
  return d.eventType === "Other" && d.customType.trim() ? d.customType.trim() : d.eventType;
}

function detailsInput(d: WizardDraft): EventDetailsInput {
  return {
    name: d.name,
    description: d.description,
    eventType: effectiveType(d),
    date: d.date,
    startTime: d.startTime,
    timezone: d.timezone,
    durationMinutes: durationOf(d) || "",
    venueName: d.venueName,
    address: d.address,
    city: d.city,
    state: d.state,
    country: d.country,
    latitude: d.latitude ?? undefined,
    longitude: d.longitude ?? undefined,
    maxCapacity: d.maxCapacity.trim() === "" ? "" : Number(d.maxCapacity),
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

function draftFromDetail(detail: EventDetail): WizardDraft {
  const e = detail.event;
  const local = utcToZoned(e.startDatetime, e.timezone);
  const known = EVENT_CATEGORIES.some((c) => c.types.includes(e.eventType));
  return {
    ...emptyDraft(),
    eventId: e.id,
    name: e.name,
    description: e.description,
    categoryId: categoryOf(e.eventType).id,
    eventType: known ? e.eventType : "Other",
    customType: known ? "" : e.eventType,
    date: local.date,
    startTime: local.time,
    endTime: addMinutesHHmm(local.time, e.durationMinutes),
    durationOverride: e.durationMinutes > 1440 ? e.durationMinutes : null,
    timezone: e.timezone,
    venueName: e.venueName,
    address: e.address,
    city: e.city,
    state: e.state,
    country: e.country,
    latitude: e.latitude,
    longitude: e.longitude,
    locationConfirmed: true,
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
  };
}

export function EventWizardPage() {
  const { eventId: routeEventId } = useParams();
  const editing = Boolean(routeEventId);
  const { ready, signedIn } = useAuthSession();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [timelineErrors, setTimelineErrors] = useState<FieldErrors[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [pendingGuest, setPendingGuest] = useState("");
  const [timelineEditing, setTimelineEditing] = useState(false);
  const syncedRef = useRef<string>("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = STEPS[stepIndex];

  const reloadDetail = useCallback(async (id: string) => {
    const next = await eventsApi.get(id);
    setDetail(next);
    return next;
  }, []);

  // Load: edit → server; create → restore the canonical draft from this device.
  useEffect(() => {
    if (!ready || !signedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        if (editing) {
          const d = await reloadDetail(routeEventId!);
          if (cancelled) return;
          const next = draftFromDetail(d);
          setDraft(next);
          syncedRef.current = JSON.stringify([detailsInput(next), timelineInput(next)]);
          return;
        }
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { draft: WizardDraft; at: string; stepIndex?: number };
        const restored = { ...emptyDraft(), ...saved.draft };
        setDraft(restored);
        setRestoredAt(saved.at);
        setStepIndex(Math.min(saved.stepIndex ?? 0, STEPS.length - 1));
        if (restored.eventId) {
          try {
            await reloadDetail(restored.eventId);
          } catch {
            /* draft event deleted or not ours — guests step will recreate it */
            setDraft((d) => ({ ...d, eventId: null }));
            setStepIndex((i) => Math.min(i, STEPS.indexOf("Timeline")));
          }
        }
      } catch (err) {
        if (!cancelled) setBanner(errorMessage(err, "Unable to load this invitation. Please try again."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, signedIn, editing, routeEventId, reloadDetail]);

  // Auto-save the canonical draft (create mode) on every change.
  useEffect(() => {
    if (editing || loading) return;
    const t = setTimeout(() => {
      if (!draft.name && !draft.venueName && !draft.eventId) return;
      const at = new Date().toISOString();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ draft, at, stepIndex }));
      setSavedAt(at);
    }, 400);
    return () => clearTimeout(t);
  }, [draft, stepIndex, editing, loading]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, [stepIndex]);

  const update = useCallback(<K extends keyof WizardDraft>(k: K, v: WizardDraft[K]) => setDraft((d) => ({ ...d, [k]: v })), []);
  const capacityNum = Number(draft.maxCapacity) || 0;
  const guests: GuestWithPass[] = detail?.guests ?? [];
  const activeGuests = guests.filter((g) => g.status !== "CANCELLED");

  function validateStep(s: Step): boolean {
    if (s === "Review" || s === "Guests") {
      for (const other of STEPS.slice(0, STEPS.indexOf("Guests"))) if (!validateStep(other)) return false;
      return true;
    }
    const all = validateEventDetails(detailsInput(draft), { maxCapacityLimit: EVENT_MAX_CAPACITY, requireFuture: !editing });
    const fieldErrors: FieldErrors = all.ok ? {} : { ...all.errors };
    if (fieldErrors.startTime === "Start time is required.") fieldErrors.startTime = "Enter a start time like 07:30 PM.";
    if (!minutesOf(draft.endTime) && minutesOf(draft.endTime) !== 0) fieldErrors.endTime = "Enter an end time like 10:30 PM.";
    if (draft.eventType === "Other" && !draft.customType.trim()) fieldErrors.eventType = "Name the event type.";
    const mine: FieldErrors = {};
    for (const f of STEP_FIELDS[s]) if (fieldErrors[f]) mine[f] = fieldErrors[f];
    if (s === "Venue & Map" && !mine.maxCapacity && activeGuests.length > capacityNum) {
      mine.maxCapacity = `You already have ${activeGuests.length} guests — capacity must be at least that.`;
    }
    if (s === "Timeline") {
      const start = zonedToUtcIso(draft.date, draft.startTime, draft.timezone);
      if (start) {
        const tl = validateTimeline(timelineInput(draft), { startDatetime: start, durationMinutes: durationOf(draft) });
        setTimelineErrors(tl.ok ? [] : tl.errors);
        if (!tl.ok) {
          setStepIndex(STEPS.indexOf("Timeline"));
          setBanner("Some timeline entries need fixing.");
          return false;
        }
      }
    }
    setErrors((prev) => {
      const next = { ...prev };
      for (const f of STEP_FIELDS[s]) delete next[f];
      return { ...next, ...mine };
    });
    if (Object.keys(mine).length) {
      setStepIndex(STEPS.indexOf(s));
      return false;
    }
    return true;
  }

  function applyServerError(err: unknown, fallback: string) {
    if (err instanceof EmApiError && err.fieldErrors) {
      setErrors(err.fieldErrors);
      const first = STEPS.find((s) => STEP_FIELDS[s].some((f) => err.fieldErrors?.[f]));
      if (first) setStepIndex(STEPS.indexOf(first));
    }
    if (err instanceof EmApiError && Array.isArray(err.details?.timeline)) {
      setTimelineErrors(err.details!.timeline as FieldErrors[]);
      setStepIndex(STEPS.indexOf("Timeline"));
    }
    setBanner(errorMessage(err, fallback));
  }

  /** Create the server draft (first time) or push the latest details + timeline to it. */
  async function syncServerDraft(): Promise<string | null> {
    const snapshot = JSON.stringify([detailsInput(draft), timelineInput(draft)]);
    try {
      if (!draft.eventId) {
        const created = await eventsApi.create({ details: detailsInput(draft), timeline: timelineInput(draft), guests: [] });
        syncedRef.current = snapshot;
        setDraft((d) => ({ ...d, eventId: created.event.id }));
        setDetail(created);
        return created.event.id;
      }
      if (snapshot !== syncedRef.current) {
        const updated = await eventsApi.update(draft.eventId, { details: detailsInput(draft), timeline: timelineInput(draft) });
        syncedRef.current = snapshot;
        setDetail(updated);
      } else if (!detail) {
        await reloadDetail(draft.eventId);
      }
      return draft.eventId;
    } catch (err) {
      applyServerError(err, "Unable to save the invitation. Please check the required fields.");
      return null;
    }
  }

  async function goTo(index: number) {
    setBanner(null);
    if (index > stepIndex) {
      if (!validateStep(STEPS[Math.min(index, STEPS.length - 1)] === "Review" ? "Review" : step)) return;
      if (step === "Timeline" && timelineEditing) {
        setBanner('Save or cancel the timeline item you are editing before continuing.');
        return;
      }
      if (step === "Guests" && pendingGuest) {
        setBanner(`You typed "${pendingGuest}" but didn't add them. Click "Add guest" to save them, or clear the name.`);
        return;
      }
      if (STEPS[index] === "Guests" || STEPS[index] === "Review") {
        setBusy(true);
        const id = await syncServerDraft();
        setBusy(false);
        if (!id) return;
      }
    }
    setStepIndex(index);
  }

  async function finish(mode: "draft" | "create") {
    setBanner(null);
    if (!validateStep("Review")) return;
    setBusy(true);
    const id = await syncServerDraft();
    setBusy(false);
    if (!id) return;
    if (!editing) localStorage.removeItem(AUTOSAVE_KEY);
    if (mode === "draft") {
      navigate("/events", { state: { notice: `"${draft.name}" saved as a draft.` } });
      return;
    }
    navigate(`/events/${id}/manage`, {
      state: {
        notice: editing
          ? "Invitation updated."
          : `Invitation created with ${activeGuests.length} guest${activeGuests.length === 1 ? "" : "s"}. Generate passes for your guests, then publish and share.`,
      },
    });
  }

  /** Adds the template's schedule inside the organizer's own time window — never changes their times. */
  function applyTemplate() {
    const tpl = templateFor(draft.eventType);
    setDraft((d) => {
      const window = durationOf(d);
      const items = tpl.timeline
        .filter((t) => t.offsetMinutes < window)
        .map((t) => ({
          key: newKey(),
          start: addMinutesHHmm(d.startTime, t.offsetMinutes),
          end: addMinutesHHmm(d.startTime, Math.min(window, t.offsetMinutes + t.durationMinutes)),
          title: t.title,
          description: t.description ?? "",
          location: "",
        }));
      return { ...d, description: d.description || tpl.descriptionHint, timeline: items };
    });
  }

  if (!ready) return <main className="mx-auto max-w-5xl px-4 py-12"><LoadingBlock /></main>;
  if (!signedIn) return <SignInRequired />;
  if (loading) return <main className="mx-auto max-w-5xl px-4 py-12"><LoadingBlock label="Loading your invitation…" /></main>;

  const startIso = zonedToUtcIso(draft.date, draft.startTime, draft.timezone);
  const point = draft.latitude !== null && draft.longitude !== null ? { lat: draft.latitude, lng: draft.longitude } : null;
  const category = EVENT_CATEGORIES.find((c) => c.id === draft.categoryId) ?? EVENT_CATEGORIES[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 pb-32">
      <PageTitle eyebrow={editing ? "Edit invitation" : "My Invitations · New"} title={editing ? draft.name || "Edit invitation" : "Create an invitation"}>
        <Link to={editing ? `/events/${routeEventId}/manage` : "/events"} className={buttonClassName("ghost", "sm")}>
          Cancel
        </Link>
      </PageTitle>

      <ol className="mt-8 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => (i < stepIndex ? void goTo(i) : undefined)}
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
            Restored your invitation in progress from {new Date(restoredAt).toLocaleString()}.{" "}
            <button
              type="button"
              className="font-medium text-ink underline"
              onClick={() => {
                localStorage.removeItem(AUTOSAVE_KEY);
                setDraft(emptyDraft());
                setDetail(null);
                setRestoredAt(null);
                setStepIndex(0);
              }}
            >
              Start over
            </button>
            {draft.eventId ? " (the saved draft stays in My Invitations)" : ""}
          </Notice>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        <ErrorBanner message={banner} />
        {notice ? <Notice tone="success">{notice}</Notice> : null}
      </div>

      <section aria-labelledby="step-heading" className={cn("mt-6", step !== "Review" && "rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8")}>
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none">
          {step === "Details" && "What are you celebrating?"}
          {step === "Date & Time" && "Date & time"}
          {step === "Venue & Map" && "Venue & map"}
          {step === "Timeline" && "Event timeline"}
          {step === "Guests" && "Guests"}
          {step === "Review" && "Review your invitation"}
        </h2>

        {step === "Details" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <FormField label="Invitation / event name" required error={errors.name} className="sm:col-span-2">
              {(p) => <Input {...p} value={draft.name} onChange={(e) => update("name", e.target.value)} maxLength={120} placeholder="Arjun & Priya's Wedding" />}
            </FormField>
            <FormField label="Event category" required>
              {(p) => (
                <Select
                  {...p}
                  value={draft.categoryId}
                  onChange={(e) => {
                    const c = EVENT_CATEGORIES.find((x) => x.id === e.target.value)!;
                    setDraft((d) => ({ ...d, categoryId: c.id, eventType: c.types[0] }));
                  }}
                >
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Event type" required error={errors.eventType}>
              {(p) => (
                <Select {...p} value={draft.eventType} onChange={(e) => update("eventType", e.target.value)}>
                  {category.types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            {draft.eventType === "Other" ? (
              <FormField label="Name the event type" required className="sm:col-span-2">
                {(p) => <Input {...p} value={draft.customType} onChange={(e) => update("customType", e.target.value)} maxLength={60} placeholder="e.g. Book launch" />}
              </FormField>
            ) : null}
            <FormField label="Description" required error={errors.description} className="sm:col-span-2">
              {(p) => (
                <Textarea {...p} value={draft.description} onChange={(e) => update("description", e.target.value)} placeholder={templateFor(draft.eventType).descriptionHint} maxLength={5000} />
              )}
            </FormField>
          </div>
        ) : null}

        {step === "Date & Time" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <FormField label="Date" required error={errors.date}>
              {(p) => <Input {...p} type="date" value={draft.date} onChange={(e) => update("date", e.target.value)} />}
            </FormField>
            <FormField label="Time zone" error={errors.timezone}>
              {(p) => (
                <Select {...p} value={draft.timezone} onChange={(e) => update("timezone", e.target.value)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Start time" required error={errors.startTime} hint="Type it, e.g. 07:30 PM">
              {(p) => (
                <TimeInput
                  {...p}
                  value={draft.startTime}
                  onValidityMessage={(msg) => setErrors((e) => ({ ...e, startTime: msg ?? "" }))}
                  onChange={(v) =>
                    setDraft((d) => {
                      const dur = durationOf(d);
                      return { ...d, startTime: v, endTime: v && dur && !d.durationOverride ? addMinutesHHmm(v, dur) : d.endTime };
                    })
                  }
                />
              )}
            </FormField>
            <FormField
              label="End time"
              required
              error={errors.endTime || errors.durationMinutes}
              hint={durationOf(draft) ? `Duration ${formatDuration(durationOf(draft))}${(minutesOf(draft.endTime) ?? 0) <= (minutesOf(draft.startTime) ?? 0) ? " · ends the next day" : ""}` : "Type it, e.g. 11:00 PM"}
            >
              {(p) => (
                <TimeInput
                  {...p}
                  value={draft.endTime}
                  onValidityMessage={(msg) => setErrors((e) => ({ ...e, endTime: msg ?? "" }))}
                  onChange={(v) => setDraft((d) => ({ ...d, endTime: v, durationOverride: null }))}
                />
              )}
            </FormField>
          </div>
        ) : null}

        {step === "Venue & Map" ? <VenueStep draft={draft} setDraft={setDraft} errors={errors} point={point} capacityNum={capacityNum} setErrors={setErrors} /> : null}

        {step === "Timeline" ? <TimelineStep draft={draft} setDraft={setDraft} errors={timelineErrors} onTemplate={applyTemplate} onEditingChange={setTimelineEditing} /> : null}

        {step === "Guests" && draft.eventId ? (
          <GuestsStep
            eventId={draft.eventId}
            draft={draft}
            guests={guests}
            capacity={capacityNum}
            reload={async () => {
              await reloadDetail(draft.eventId!);
            }}
            setBanner={setBanner}
            setNotice={setNotice}
            onPendingChange={setPendingGuest}
          />
        ) : null}

        {step === "Review" ? (
          <ReviewStep
            draft={draft}
            startIso={startIso}
            point={point}
            guests={activeGuests}
            categoryLabel={categoryOf(draft.eventType).label}
            onEdit={(s) => setStepIndex(STEPS.indexOf(s))}
            eventId={draft.eventId}
          />
        ) : null}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-xs text-ink-muted" aria-live="polite">
            {!editing && savedAt ? `Saved on this device · ${new Date(savedAt).toLocaleTimeString()}` : ""}
            {draft.eventId && !editing ? " · Guests are saved to your account" : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            {stepIndex > 0 ? (
              <Button type="button" variant="secondary" onClick={() => void goTo(stepIndex - 1)} disabled={busy}>
                Back
              </Button>
            ) : null}
            {step === "Review" ? (
              editing ? (
                <Button type="button" variant="gold" onClick={() => void finish("create")} disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={() => void finish("draft")} disabled={busy}>
                    Save Draft
                  </Button>
                  <Button type="button" variant="gold" onClick={() => void finish("create")} disabled={busy}>
                    {busy ? "Creating…" : "Create Invitation"}
                  </Button>
                </>
              )
            ) : (
              <Button type="button" variant="gold" onClick={() => void goTo(stepIndex + 1)} disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Venue & Map
// ---------------------------------------------------------------------------

function VenueStep({
  draft,
  setDraft,
  errors,
  setErrors,
  point,
  capacityNum,
}: {
  draft: WizardDraft;
  setDraft: Dispatch<SetStateAction<WizardDraft>>;
  errors: FieldErrors;
  setErrors: Dispatch<SetStateAction<FieldErrors>>;
  point: LatLng | null;
  capacityNum: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [detected, setDetected] = useState<GeocodeResult | null>(null);
  const abort = useRef<AbortController | null>(null);
  const update = <K extends keyof WizardDraft>(k: K, v: WizardDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const setPoint = useCallback(
    (p: LatLng, opts: { mapUrl?: string; fromResult?: GeocodeResult } = {}) => {
      const lat = round6(p.lat);
      const lng = round6(p.lng);
      setDraft((d) => {
        const r = opts.fromResult;
        return {
          ...d,
          latitude: lat,
          longitude: lng,
          locationConfirmed: false,
          mapUrl: opts.mapUrl ?? "",
          venueName: d.venueName || (r?.name ?? ""),
          address: d.address || (r ? r.street || r.name : ""),
          city: d.city || r?.city || "",
          state: d.state || r?.state || "",
          country: d.country || r?.country || "",
        };
      });
      setErrors((e) => ({ ...e, location: "" }));
      setDetected(opts.fromResult ?? null);
      if (!opts.fromResult) {
        abort.current?.abort();
        const ctl = new AbortController();
        abort.current = ctl;
        void mapProvider.reverse({ lat, lng }, ctl.signal).then((r) => !ctl.signal.aborted && setDetected(r));
      }
    },
    [setDraft, setErrors],
  );

  async function find() {
    setSearchNote(null);
    setResults(null);
    const typed = query.trim();
    const parsed = parseLocationInput(typed);
    if (typed && parsed.kind === "point") {
      setPoint(parsed.point, { mapUrl: parsed.mapUrl });
      setSearchNote("Location set from the coordinates / link you entered.");
      return;
    }
    if (parsed.kind === "short-link") {
      setSearchNote("Short Maps links (maps.app.goo.gl) can't be read here. Open the link, then paste the full URL from the address bar — or type the place name.");
      return;
    }
    const candidates = typed
      ? [parsed.kind === "query" ? parsed.query : typed]
      : [
          [draft.venueName, draft.city].filter(Boolean).join(", "),
          [draft.address, draft.city, draft.country].filter(Boolean).join(", "),
          [draft.city, draft.country].filter(Boolean).join(", "),
        ].filter(Boolean);
    if (!candidates.length) {
      setSearchNote("Type a place to search, or tap the map.");
      return;
    }
    // Broaden progressively: "Hall, Area, City" → "Area, City" → "City".
    const expanded: string[] = [];
    for (const c of candidates) {
      const parts = c.split(",").map((x) => x.trim()).filter(Boolean);
      for (let i = 0; i < parts.length; i += 1) expanded.push(parts.slice(i).join(", "));
    }
    setSearching(true);
    try {
      for (const q of Array.from(new Set(expanded))) {
        const rows = await mapProvider.geocode(q);
        if (rows.length) {
          setResults(rows);
          if (q !== expanded[0]) setSearchNote(`No exact match — showing results for "${q}".`);
          return;
        }
      }
      setSearchNote("No places found. Try a shorter name, or tap the map to drop the pin.");
    } catch (err) {
      setSearchNote(err instanceof Error ? err.message : "Location search failed.");
    } finally {
      setSearching(false);
    }
  }

  const capacityError = errors.maxCapacity;

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <FormField label="Venue name" required error={errors.venueName} className="sm:col-span-2">
        {(p) => <Input {...p} value={draft.venueName} onChange={(e) => update("venueName", e.target.value)} placeholder="Grand Convention Hall" />}
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
          Location <span className="text-gold-dark">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Search location, paste a Google Maps link, or enter coordinates"
            className="min-w-0 flex-1"
            placeholder="Search location, paste a Maps link, or 17.385044, 78.486671"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void find();
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => void find()} disabled={searching}>
            {searching ? "Searching…" : "Find on Map"}
          </Button>
        </div>
        {searchNote ? <p className="mt-2 text-xs text-ink-muted" role="status">{searchNote}</p> : null}
        {results?.length ? (
          <div className="mt-2 rounded-xl border border-stone-200 bg-white">
            <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-dark">Search results</p>
            <ul className="divide-y divide-stone-100 text-sm" aria-label="Search results">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-cream focus:bg-cream focus:outline-none"
                    onClick={() => {
                      setPoint(r, { fromResult: r });
                      setResults(null);
                      setSearchNote(null);
                    }}
                  >
                    <span className="block font-medium">{r.name}</span>
                    <span className="block text-xs text-ink-muted">{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-3">
          <LocationMap value={point} label="Venue map" onChange={(p) => setPoint(p)} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {point && isValidLatLng(point) ? (
            <>
              <span className="font-mono tabular-nums">
                {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
              </span>
              <a className="text-xs font-medium text-gold-dark underline" href={openInMapsUrl(point)} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
              {draft.locationConfirmed ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-300">✓ Location confirmed</span>
              ) : (
                <Button type="button" size="sm" onClick={() => update("locationConfirmed", true)}>
                  Confirm Location
                </Button>
              )}
            </>
          ) : (
            <span className="text-xs text-ink-muted">Search above, or tap/click the map to place the pin. Drag the pin to fine-tune.</span>
          )}
        </div>
        {detected && point && detected.label && detected.label !== draft.address ? (
          <p className="mt-2 text-xs text-ink-muted">
            Detected address: <span className="text-ink">{detected.label}</span>{" "}
            <button
              type="button"
              className="font-medium text-gold-dark underline"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  address: detected.street || detected.name,
                  city: detected.city ?? d.city,
                  state: detected.state ?? d.state,
                  country: detected.country ?? d.country,
                }))
              }
            >
              Use this address
            </button>
          </p>
        ) : null}
        {errors.location ? (
          <p className="mt-1 text-xs font-medium text-red-700" role="alert">
            {errors.location}
          </p>
        ) : null}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-muted">Enter coordinates manually</summary>
          <div className="mt-2 grid max-w-md grid-cols-2 gap-2">
            <FormField label="Latitude (N/S)">
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  defaultValue={draft.latitude ?? ""}
                  key={`lat-${draft.latitude}`}
                  onBlur={(e) => {
                    const lat = Number(e.target.value);
                    if (e.target.value.trim() && Number.isFinite(lat) && draft.longitude !== null) setPoint({ lat, lng: draft.longitude });
                    else if (e.target.value.trim()) update("latitude", Number.isFinite(lat) ? lat : null);
                  }}
                />
              )}
            </FormField>
            <FormField label="Longitude (E/W)">
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  defaultValue={draft.longitude ?? ""}
                  key={`lng-${draft.longitude}`}
                  onBlur={(e) => {
                    const lng = Number(e.target.value);
                    if (e.target.value.trim() && Number.isFinite(lng) && draft.latitude !== null) setPoint({ lat: draft.latitude, lng });
                    else if (e.target.value.trim()) update("longitude", Number.isFinite(lng) ? lng : null);
                  }}
                />
              )}
            </FormField>
          </div>
        </details>
      </div>

      <FormField label="Maximum attendees" required error={capacityError} hint={`Whole number from 1 to ${EVENT_MAX_CAPACITY.toLocaleString()}.`}>
        {(p) => (
          <Input
            {...p}
            type="text"
            inputMode="numeric"
            placeholder="e.g. 150"
            value={draft.maxCapacity}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              update("maxCapacity", v);
              setErrors((prev) => ({ ...prev, maxCapacity: v ? (validateCapacity(v, EVENT_MAX_CAPACITY) ?? "") : "" }));
            }}
          />
        )}
      </FormField>
      <div className="flex items-end pb-2">
        {draft.maxCapacity && !validateCapacity(draft.maxCapacity, EVENT_MAX_CAPACITY) ? (
          <p className="font-serif text-xl" aria-live="polite">
            Maximum capacity: {capacityNum.toLocaleString()}
          </p>
        ) : null}
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

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function TimelineStep({
  draft,
  setDraft,
  errors,
  onTemplate,
  onEditingChange,
}: {
  draft: WizardDraft;
  setDraft: Dispatch<SetStateAction<WizardDraft>>;
  errors: FieldErrors[];
  onTemplate: () => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  useEffect(() => onEditingChange(editingKey !== null), [editingKey, onEditingChange]);
  const [form, setForm] = useState<TimelineDraft | null>(null);
  const [formError, setFormError] = useState<FieldErrors>({});
  const endOfEvent = addMinutesHHmm(draft.startTime, durationOf(draft));
  const startIso = zonedToUtcIso(draft.date, draft.startTime, draft.timezone);

  function openEditor(item: TimelineDraft | null) {
    const last = draft.timeline[draft.timeline.length - 1];
    const start = last?.end || draft.startTime;
    const next = item ?? { key: newKey(), start, end: addMinutesHHmm(start, 30), title: "", description: "", location: "" };
    setForm(next);
    setEditingKey(next.key);
    setFormError({});
  }

  function save() {
    if (!form || !startIso) return;
    const list = draft.timeline.some((t) => t.key === form.key) ? draft.timeline.map((t) => (t.key === form.key ? form : t)) : [...draft.timeline, form];
    const idx = list.findIndex((t) => t.key === form.key);
    const check = validateTimeline(timelineInput({ ...draft, timeline: list }), { startDatetime: startIso, durationMinutes: durationOf(draft) });
    const mine = check.ok ? {} : (check.errors[idx] ?? {});
    if (!form.start) mine.startTime = "Enter a start time like 07:30 PM.";
    if (!form.end) mine.endTime = "Enter an end time like 08:00 PM.";
    if (Object.keys(mine).length) {
      setFormError(mine);
      return;
    }
    setDraft((d) => ({ ...d, timeline: list }));
    setEditingKey(null);
    setForm(null);
  }

  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const list = [...d.timeline];
      const target = index + dir;
      if (target < 0 || target >= list.length) return d;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...d, timeline: list };
    });

  const editor = form ? (
    <div className="rounded-2xl border border-gold/50 bg-cream/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Start time" required error={formError.startTime}>
          {(p) => <TimeInput {...p} value={form.start} onChange={(v) => setForm({ ...form, start: v })} onValidityMessage={(m) => setFormError((e) => ({ ...e, startTime: m ?? "" }))} />}
        </FormField>
        <FormField label="End time" required error={formError.endTime}>
          {(p) => <TimeInput {...p} value={form.end} onChange={(v) => setForm({ ...form, end: v })} onValidityMessage={(m) => setFormError((e) => ({ ...e, endTime: m ?? "" }))} />}
        </FormField>
        <FormField label="Title" required error={formError.title} className="sm:col-span-2">
          {(p) => <Input {...p} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Welcome Ceremony" autoFocus />}
        </FormField>
        <FormField label="Description" error={formError.description} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} className="min-h-[64px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </FormField>
        <FormField label="Location" hint="Optional, e.g. Main lawn" error={formError.location} className="sm:col-span-2">
          {(p) => <Input {...p} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}
        </FormField>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={save}>
          Save item
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditingKey(null);
            setForm(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="mt-4">
      <p className="text-sm text-ink-muted">
        Your event runs {formatTime12(draft.startTime)} – {formatTime12(endOfEvent)} ({formatDuration(durationOf(draft))}). Items must fit inside that window.
      </p>

      {draft.timeline.length ? (
        <ol className="relative mt-6 space-y-6 before:absolute before:bottom-2 before:left-[5.5rem] before:top-2 before:w-px before:bg-gold/40 sm:before:left-[6.5rem]">
          {draft.timeline.map((t, i) => {
            const e = errors[i] ?? {};
            const hasError = Object.values(e).some(Boolean);
            return (
              <li key={t.key} className="relative grid grid-cols-[5rem_1fr] gap-4 sm:grid-cols-[6rem_1fr]">
                <div className="pt-1 text-right">
                  <p className="text-sm font-semibold tabular-nums text-gold-dark">{formatTime12(t.start)}</p>
                  <p className="text-xs tabular-nums text-ink-muted">{formatTime12(t.end)}</p>
                </div>
                <span aria-hidden className={cn("absolute left-[5.5rem] top-2 h-3 w-3 -translate-x-1/2 rounded-full ring-4 ring-white sm:left-[6.5rem]", hasError ? "bg-red-500" : "bg-gold")} />
                <div className="pl-4">
                  {editingKey === t.key ? (
                    editor
                  ) : (
                    <div className={cn("rounded-2xl border bg-white p-4 shadow-sm", hasError ? "border-red-300" : "border-stone-200")}>
                      <p className="text-xs tabular-nums text-ink-muted">
                        {formatTime12(t.start)} – {formatTime12(t.end)}
                        {t.location ? ` · ${t.location}` : ""}
                      </p>
                      <p className="mt-0.5 font-serif text-lg">{t.title || <em className="text-ink-faint">Untitled</em>}</p>
                      {t.description ? <p className="mt-1 text-sm text-ink-muted">{t.description}</p> : null}
                      {hasError ? <p className="mt-1 text-xs font-medium text-red-700">{Object.values(e).filter(Boolean)[0]}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="secondary" onClick={() => openEditor(t)} aria-label={`Edit ${t.title || "item"}`}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, timeline: d.timeline.filter((x) => x.key !== t.key) }))} aria-label={`Delete ${t.title || "item"}`}>
                          Delete
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${t.title || "item"} earlier`}>
                          ↑
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === draft.timeline.length - 1} aria-label={`Move ${t.title || "item"} later`}>
                          ↓
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 px-6 py-8 text-center text-sm text-ink-muted">No timeline items yet.</div>
      )}

      {editingKey && !draft.timeline.some((t) => t.key === editingKey) ? <div className="mt-6">{editor}</div> : null}

      {!editingKey ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => openEditor(null)}>
            + Add timeline item
          </Button>
          {!draft.timeline.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={onTemplate}>
              Start from the {draft.eventType} template
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guests (server-backed — same list as the event's Guests page)
// ---------------------------------------------------------------------------

function GuestsStep({
  eventId,
  draft,
  guests,
  capacity,
  reload,
  setBanner,
  setNotice,
  onPendingChange,
}: {
  eventId: string;
  draft: WizardDraft;
  guests: GuestWithPass[];
  capacity: number;
  reload: () => Promise<void>;
  setBanner: (m: string | null) => void;
  setNotice: (m: string | null) => void;
  onPendingChange: (name: string) => void;
}) {
  const [panel, setPanel] = useState<"single" | "csv">("single");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<GuestWithPass | null>(null);
  const active = guests.filter((g) => g.status !== "CANCELLED");
  const remaining = Math.max(0, capacity - active.length);
  const shareEvent = useMemo(
    () => ({
      name: draft.name,
      startDatetime: zonedToUtcIso(draft.date, draft.startTime, draft.timezone) ?? new Date().toISOString(),
      timezone: draft.timezone,
      durationMinutes: durationOf(draft),
      venueName: draft.venueName,
      city: draft.city,
    }),
    [draft],
  );

  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-ink-muted" aria-live="polite">
        <span className="font-semibold text-ink">{active.length}</span> / {capacity.toLocaleString()} guests · saved to your account as you add them. Generate a pass for any guest now or later.
      </p>
      <div className="flex gap-2" role="tablist" aria-label="Add guests">
        {(["single", "csv"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={panel === t}
            type="button"
            onClick={() => setPanel(t)}
            className={cn("rounded-full px-4 py-2 text-sm", panel === t ? "bg-ink text-cream" : "border border-stone-300 bg-white")}
          >
            {t === "single" ? "Add a guest" : "Import CSV"}
          </button>
        ))}
      </div>
      {remaining === 0 ? (
        <Notice tone="warn">Maximum event capacity has been reached. Increase capacity in Venue & Map to add more guests.</Notice>
      ) : panel === "single" ? (
        <GuestForm
          submitLabel="Add guest"
          busy={busy}
          onDirtyChange={onPendingChange}
          onSubmit={async (g) => {
            setBusy(true);
            setBanner(null);
            try {
              await eventsApi.addGuests(eventId, [g]);
              await reload();
              setNotice(`${g.name} added.`);
              return true;
            } catch (err) {
              setBanner(errorMessage(err, "Unable to add this guest."));
              return false;
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <CsvImport
          busy={busy}
          existing={active}
          remainingCapacity={remaining}
          onImport={async (rows) => {
            setBusy(true);
            setBanner(null);
            try {
              await eventsApi.addGuests(eventId, rows);
              await reload();
              setNotice(`${rows.length} guests imported.`);
            } catch (err) {
              setBanner(errorMessage(err, "Unable to import these guests."));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {guests.length ? (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200" aria-label="Added guests">
          {guests.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {g.name}
                  {g.role !== "GUEST" ? <span className="font-normal text-ink-muted"> · {GUEST_ROLE_LABELS[g.role]}</span> : null}
                </p>
                <p className="truncate text-xs text-ink-muted">{[g.email, g.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
                {g.bio ? <p className="truncate text-xs text-ink-muted">{g.bio}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <PassActions
                  eventId={eventId}
                  event={shareEvent}
                  guest={g}
                  editable
                  onChanged={reload}
                  onNotice={(m) => setNotice(m)}
                  onError={setBanner}
                />
                {g.status !== "CANCELLED" ? (
                  <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${g.name}`} onClick={() => setRemoving(g)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No guests yet. You can also add guests later from the invitation's Guests page.</p>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? "guest"}?`}
        body="Their pass (if any) stops working immediately."
        confirmLabel="Remove guest"
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          setBusy(true);
          try {
            await eventsApi.removeGuest(eventId, removing.id);
            await reload();
          } catch (err) {
            setBanner(errorMessage(err, "Unable to remove this guest."));
          } finally {
            setBusy(false);
            setRemoving(null);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review — invitation card + full summary
// ---------------------------------------------------------------------------

function ReviewStep({
  draft,
  startIso,
  point,
  guests,
  categoryLabel,
  onEdit,
  eventId,
}: {
  draft: WizardDraft;
  startIso: string | null;
  point: LatLng | null;
  guests: GuestWithPass[];
  categoryLabel: string;
  onEdit: (s: Step) => void;
  eventId: string | null;
}) {
  const date = startIso ? formatEventDate(startIso, draft.timezone) : draft.date;
  const time = formatTime12(draft.startTime);
  const endTime = formatTime12(draft.endTime);
  const type = effectiveType(draft);
  const withPass = guests.filter((g) => g.pass).length;

  const Section = ({ title, step, children }: { title: string; step: Step; children: React.ReactNode }) => (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-label={title}>
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{title}</h3>
        <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(step)} aria-label={`Edit ${title}`}>
          Edit
        </Button>
      </div>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <article aria-label="Invitation preview" className="relative overflow-hidden rounded-[28px] border border-gold/40 bg-cream px-6 py-10 text-center shadow-lift sm:px-10">
          <div aria-hidden className="pointer-events-none absolute inset-3 rounded-[22px] border border-gold/30" />
          <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-gold-dark">You're invited</p>
          <h3 className="mt-5 font-serif text-4xl leading-tight text-ink">{draft.name || "Your event"}</h3>
          <p className="mt-2 font-display text-xl italic text-ink-muted">{type}</p>
          <div aria-hidden className="mx-auto mt-6 h-px w-16 bg-gold/60" />
          <p className="mt-6 font-serif text-2xl">{date}</p>
          <p className="mt-1 text-sm uppercase tracking-[0.2em] text-ink-muted">
            {time} – {endTime}
          </p>
          <p className="mt-6 font-medium">{draft.venueName}</p>
          <p className="text-sm text-ink-muted">{[draft.city, draft.state].filter(Boolean).join(", ")}</p>
          <div aria-hidden className="mx-auto mt-6 h-px w-16 bg-gold/60" />
          <p className="mx-auto mt-6 max-w-sm whitespace-pre-line text-sm leading-relaxed text-ink-muted">{draft.description}</p>
          {point && isValidLatLng(point) ? (
            <div className="mt-6 text-left">
              <LocationMap value={point} label={`Map of ${draft.venueName}`} height={160} />
            </div>
          ) : null}
          <p className="mt-6 text-[11px] uppercase tracking-[0.3em] text-gold-dark">Invana</p>
        </article>
      </div>

      <div className="space-y-4">
        <Section title="Event details" step="Details">
          <p className="font-serif text-lg">{draft.name}</p>
          <p className="text-ink-muted">
            {categoryLabel} · {type}
          </p>
          <p className="mt-2 whitespace-pre-line">{draft.description}</p>
        </Section>
        <Section title="Date & time" step="Date & Time">
          <p>{date}</p>
          <p className="text-ink-muted">
            {time} – {endTime} · {formatDuration(durationOf(draft))} · {draft.timezone}
          </p>
        </Section>
        <Section title="Venue & location" step="Venue & Map">
          <p className="font-medium">{draft.venueName}</p>
          <p className="text-ink-muted">{[draft.address, draft.city, draft.state, draft.country].filter(Boolean).join(", ")}</p>
          {point && isValidLatLng(point) ? (
            <p className="mt-1 font-mono text-xs">
              {point.lat.toFixed(6)}, {point.lng.toFixed(6)} ·{" "}
              <a className="font-sans font-medium text-gold-dark underline" href={openInMapsUrl(point)} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
            </p>
          ) : null}
          <p className="mt-2">Maximum capacity: {Number(draft.maxCapacity || 0).toLocaleString()}</p>
        </Section>
        <Section title="Timeline" step="Timeline">
          {draft.timeline.length ? (
            <ol className="space-y-1.5">
              {draft.timeline.map((t) => (
                <li key={t.key}>
                  <span className="tabular-nums text-gold-dark">{formatTime12(t.start)}</span> {t.title}
                  {t.location ? <span className="text-ink-muted"> · {t.location}</span> : null}
                  {t.description ? <span className="block text-xs text-ink-muted">{t.description}</span> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ink-muted">No timeline items.</p>
          )}
        </Section>
        <Section title="Guests" step="Guests">
          <p>
            <span className="font-semibold">{guests.length}</span> guest{guests.length === 1 ? "" : "s"} · {withPass} with a pass
          </p>
          {guests.length ? (
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
              {guests.map((g) => (
                <li key={g.id}>
                  {g.name}
                  {g.role !== "GUEST" ? <span className="text-ink-muted"> · {GUEST_ROLE_LABELS[g.role]}</span> : null}
                  {g.bio ? <span className="block text-xs text-ink-muted">{g.bio}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {eventId ? (
            <Link to={`/events/${eventId}/guests`} className="mt-2 inline-block text-xs font-medium text-gold-dark underline">
              View guests
            </Link>
          ) : null}
        </Section>
      </div>
    </div>
  );
}
