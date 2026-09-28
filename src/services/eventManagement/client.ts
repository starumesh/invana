import {
  emptySnapshot,
  EventService,
  handleEventRequest,
  MemoryEventRepository,
  type AttendanceFilter,
  type AttendanceView,
  type CheckInResult,
  type EventDetail,
  type EventDetailsInput,
  type EventStats,
  type EventSummary,
  type FieldErrors,
  type Guest,
  type GuestInput,
  type GuestPassView,
  type ManagedEvent,
  type MemorySnapshot,
  type Pass,
  type PublicEventView,
  type StaffAssignment,
  type StaffSearchResult,
  type TimelineInput,
} from "@event-core";
import { EdgeApiError, callEdgeFunction } from "@/services/api/edgeClient";
import { demoAuth } from "@/services/demo";
import { isDemoMode } from "@/services";

export const EVENT_MAX_CAPACITY = Number(import.meta.env.VITE_EVENT_MAX_CAPACITY) || 10_000;

export class EmApiError extends Error {
  status: number;
  code: string;
  fieldErrors?: FieldErrors;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, extra?: { fieldErrors?: FieldErrors; details?: Record<string, unknown> }) {
    super(message);
    this.name = "EmApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = extra?.fieldErrors;
    this.details = extra?.details;
  }
}

export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach Invana. Check your internet connection and try again — nothing was lost.";

// ---------------------------------------------------------------------------
// Demo Mode transport: same router + service in-process, persisted to localStorage.
// Reloaded before every request so multiple tabs (organizer + door staff) stay in sync.
// ---------------------------------------------------------------------------

const DEMO_KEY = "invana.em.v1";
const demoBuckets = new Map<string, number>();

function readSnapshot(): MemorySnapshot {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? { ...emptySnapshot(), ...(JSON.parse(raw) as MemorySnapshot) } : emptySnapshot();
  } catch {
    return emptySnapshot();
  }
}

function writeSnapshot(data: MemorySnapshot) {
  const trimmed = { ...data, audit: data.audit.slice(-500) };
  localStorage.setItem(DEMO_KEY, JSON.stringify(trimmed));
}

async function demoRequest(method: string, path: string, body?: unknown): Promise<Response> {
  const repo = new MemoryEventRepository(readSnapshot(), { buckets: demoBuckets, maxAudit: 500 });
  const service = new EventService(repo, { maxCapacityLimit: EVENT_MAX_CAPACITY });
  const user = demoAuth.currentUser() ?? demoAuth.ensureUser();
  const req = new Request(`http://demo.local/event-management${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handleEventRequest(service, req, {
    actor: { userId: user.id, email: user.email },
    ip: "demo",
    requestId: crypto.randomUUID(),
  });
  if (method !== "GET") writeSnapshot(repo.data);
  return res;
}

export const DEMO_STORAGE_KEY = DEMO_KEY;

async function request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  if (isDemoMode) {
    const res = await demoRequest(method, path, body);
    const payload = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw toApiError(res.status, payload);
    return payload as T;
  }
  try {
    const result = await callEdgeFunction<T>({ method, path: `event-management${path}`, body, auth: opts.auth ?? true });
    if (result === null) throw new EmApiError("Event management is not configured.", 503, "INTERNAL");
    return result;
  } catch (err) {
    if (err instanceof EmApiError) throw err;
    if (err instanceof EdgeApiError) {
      const payload = (err.payload ?? {}) as Record<string, unknown>;
      if (err.status === 404 && !payload.code) {
        throw new EmApiError("Event management service is not deployed yet. Ask the admin to deploy the event-management function.", 404, "NOT_FOUND");
      }
      throw toApiError(err.status, { error: err.message, ...payload });
    }
    throw new EmApiError(NETWORK_ERROR_MESSAGE, 0, "NETWORK");
  }
}

function toApiError(status: number, payload: Record<string, unknown>): EmApiError {
  return new EmApiError(
    typeof payload.error === "string" ? payload.error : `Request failed (${status}).`,
    status,
    typeof payload.code === "string" ? payload.code : "INTERNAL",
    {
      fieldErrors: payload.fieldErrors as FieldErrors | undefined,
      details: payload.details as Record<string, unknown> | undefined,
    },
  );
}

const enc = encodeURIComponent;

export const eventsApi = {
  list: () => request<{ events: EventSummary[] }>("GET", "/events").then((r) => r.events),
  create: (input: { details: EventDetailsInput; timeline?: TimelineInput[]; guests?: GuestInput[] }) =>
    request<EventDetail>("POST", "/events", input),
  get: (id: string) => request<EventDetail>("GET", `/events/${enc(id)}`),
  update: (id: string, input: { details?: EventDetailsInput; timeline?: TimelineInput[] }) =>
    request<EventDetail>("PATCH", `/events/${enc(id)}`, input),
  transition: (id: string, action: "publish" | "unpublish" | "cancel" | "complete") =>
    request<{ event: ManagedEvent }>("POST", `/events/${enc(id)}/${action}`).then((r) => r.event),

  addGuests: (id: string, guests: GuestInput[]) =>
    request<{ guests: Guest[] }>("POST", `/events/${enc(id)}/guests`, { guests }).then((r) => r.guests),
  updateGuest: (id: string, guestId: string, guest: GuestInput) =>
    request<{ guest: Guest }>("PATCH", `/events/${enc(id)}/guests/${enc(guestId)}`, guest).then((r) => r.guest),
  removeGuest: (id: string, guestId: string) =>
    request<{ removed: "DELETED" | "CANCELLED" }>("DELETE", `/events/${enc(id)}/guests/${enc(guestId)}`),
  sharePass: (id: string, guestId: string) =>
    request<{ passToken: string; passPublicId: string; guestName: string; phone: string; email: string }>(
      "POST",
      `/events/${enc(id)}/guests/${enc(guestId)}/share`,
    ),

  generatePassesBatch: (id: string, batchSize?: number) =>
    request<{ generated: number; issued: number; total: number; pending: number }>("POST", `/events/${enc(id)}/passes/generate`, { batchSize }),
  exportPasses: (id: string) =>
    request<{ passes: { name: string; email: string; phone: string; role: string; passPublicId: string; passToken: string; status: string }[] }>(
      "GET",
      `/events/${enc(id)}/passes/export`,
    ).then((r) => r.passes),
  cancelPass: (id: string, passId: string) =>
    request<{ pass: Omit<Pass, "secureToken"> }>("POST", `/events/${enc(id)}/passes/${enc(passId)}/cancel`),
  reissuePass: (id: string, passId: string) =>
    request<{ pass: Omit<Pass, "secureToken"> }>("POST", `/events/${enc(id)}/passes/${enc(passId)}/reissue`),

  checkInContext: (id: string) =>
    request<{
      access: "ORGANIZER" | "STAFF";
      event: Pick<ManagedEvent, "id" | "publicId" | "name" | "status" | "startDatetime" | "timezone" | "venueName">;
      stats: EventStats;
    }>("GET", `/events/${enc(id)}/check-in`),
  checkIn: (id: string, body: { payload?: string; passPublicId?: string; guestId?: string }) =>
    request<CheckInResult>("POST", `/events/${enc(id)}/check-in`, body),
  searchGuests: (id: string, q: string) =>
    request<{ results: StaffSearchResult[] }>("GET", `/events/${enc(id)}/check-in/search?q=${enc(q)}`).then((r) => r.results),
  attendance: (id: string, filter: AttendanceFilter = "ALL", q = "") =>
    request<AttendanceView>("GET", `/events/${enc(id)}/attendance?filter=${filter}&q=${enc(q)}`),

  listStaff: (id: string) => request<{ staff: StaffAssignment[] }>("GET", `/events/${enc(id)}/staff`).then((r) => r.staff),
  addStaff: (id: string, email: string) =>
    request<{ staff: StaffAssignment }>("POST", `/events/${enc(id)}/staff`, { email }).then((r) => r.staff),
  removeStaff: (id: string, staffId: string) => request<{ ok: true }>("DELETE", `/events/${enc(id)}/staff/${enc(staffId)}`),

  publicEvent: (slug: string) =>
    request<{ event: PublicEventView }>("GET", `/public/events/${enc(slug)}`, undefined, { auth: false }).then((r) => r.event),
  guestPass: (token: string) => request<GuestPassView>("GET", `/public/passes/${enc(token)}`, undefined, { auth: false }),
};

/**
 * Generate all pending passes in small batches so large guest lists never block
 * a single request; `onProgress` drives the "87 / 100 generated" indicator.
 */
export async function generateAllPasses(
  eventId: string,
  onProgress: (p: { issued: number; total: number }) => void,
  opts: { signal?: AbortSignal; batchSize?: number } = {},
): Promise<{ issued: number; total: number }> {
  let last = { issued: 0, total: 0 };
  for (let guard = 0; guard < 1000; guard += 1) {
    if (opts.signal?.aborted) break;
    const step = await eventsApi.generatePassesBatch(eventId, opts.batchSize ?? 25);
    last = { issued: step.issued, total: step.total };
    onProgress(last);
    if (step.pending === 0 || step.generated === 0) break;
  }
  return last;
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof EmApiError) return err.message;
  if (err instanceof Error && /fetch|network/i.test(err.message)) return NETWORK_ERROR_MESSAGE;
  return fallback;
}
