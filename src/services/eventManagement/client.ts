import {
  type AttendanceFilter,
  type AttendanceView,
  type CheckInResult,
  type EventDetail,
  type EventDetailsInput,
  type EventStats,
  type EventListPage,
  type EventOverview,
  type GuestPage,
  type GuestQuery,
  type GuestRow,
  type FieldErrors,
  type Guest,
  type GuestInput,
  type GuestPassView,
  type ManagedEvent,
  type Pass,
  type PublicEventView,
  type StaffAssignment,
  type StaffSearchResult,
  type TimelineInput,
} from "@event-core";
import { EdgeApiError, callEdgeFunction } from "@/services/api/edgeClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

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

export const SUPABASE_REQUIRED_MESSAGE =
  "Events run on Invana's Supabase backend. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY and deploy the event-management function.";

async function request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  if (!isSupabaseConfigured()) throw new EmApiError(SUPABASE_REQUIRED_MESSAGE, 503, "NOT_CONFIGURED");
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

function guestQueryString(q: GuestQuery): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && v !== null) params.set(k, String(v));
  return params.toString();
}

export const eventsApi = {
  list: (opts: { limit?: number; cursor?: string | null } = {}) =>
    request<EventListPage>("GET", `/events?limit=${opts.limit ?? 24}${opts.cursor ? `&cursor=${enc(opts.cursor)}` : ""}`),
  overview: (id: string) => request<EventOverview>("GET", `/events/${enc(id)}/overview`),
  queryGuests: (id: string, query: GuestQuery) => request<GuestPage>("GET", `/events/${enc(id)}/guests?${guestQueryString(query)}`),
  exportGuests: (id: string, query: GuestQuery) =>
    request<{ rows: GuestRow[] }>("GET", `/events/${enc(id)}/guests/export?${guestQueryString(query)}`).then((r) => r.rows),
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
  /** `purpose: "share"` marks the pass as shared; "view" only fetches the private link. */
  sharePass: (id: string, guestId: string, purpose: "view" | "share" = "view") =>
    request<{ passToken: string; passPublicId: string; guestName: string; phone: string; email: string; sharedAt: string | null }>(
      "POST",
      `/events/${enc(id)}/guests/${enc(guestId)}/share`,
      { purpose },
    ),

  generatePassesFor: (id: string, guestIds: string[]) =>
    request<{
      generated: number;
      skipped: number;
      issued: number;
      total: number;
      pending: number;
      passes: { guestId: string; publicId: string; holderName: string; holderRole: string }[];
    }>("POST", `/events/${enc(id)}/passes/generate`, { guestIds }),
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
 * Generate passes for the organizer's selection only. Large selections are sent in
 * chunks so each request stays short; `onProgress` drives "12 / 40 generated".
 */
export async function generatePassesForGuests(
  eventId: string,
  guestIds: string[],
  onProgress: (p: { done: number; total: number }) => void,
): Promise<{ generated: number; skipped: number }> {
  const CHUNK = 25;
  let generated = 0;
  let skipped = 0;
  onProgress({ done: 0, total: guestIds.length });
  for (let i = 0; i < guestIds.length; i += CHUNK) {
    const step = await eventsApi.generatePassesFor(eventId, guestIds.slice(i, i + CHUNK));
    generated += step.generated;
    skipped += step.skipped;
    onProgress({ done: Math.min(guestIds.length, i + CHUNK), total: guestIds.length });
  }
  return { generated, skipped };
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof EmApiError) return err.message;
  if (err instanceof Error && /fetch|network/i.test(err.message)) return NETWORK_ERROR_MESSAGE;
  return fallback;
}
