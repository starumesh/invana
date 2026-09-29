import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import {
  EventError,
  MESSAGES,
  UniqueViolation,
  type Attendance,
  type AuditEntry,
  type CheckInWrite,
  type CheckInWriteResult,
  type EventRepository,
  type Guest,
  type ManagedEvent,
  type Pass,
  type RawEventCounts,
  type StaffAssignment,
  type TimelineItem,
} from "../_shared/event-core/index.ts";

type Row = Record<string, unknown>;

const EVENT_COLUMNS: Record<keyof ManagedEvent, string> = {
  id: "id",
  publicId: "public_id",
  name: "name",
  description: "description",
  eventType: "event_type",
  startDatetime: "start_datetime",
  timezone: "timezone",
  durationMinutes: "duration_minutes",
  venueName: "venue_name",
  address: "address",
  city: "city",
  state: "state",
  country: "country",
  latitude: "latitude",
  longitude: "longitude",
  maxCapacity: "max_capacity",
  status: "status",
  slug: "slug",
  showGuestBios: "show_guest_bios",
  showSpeakers: "show_speakers",
  createdBy: "created_by",
  createdAt: "created_at",
  updatedAt: "updated_at",
  publishedAt: "published_at",
  cancelledAt: "cancelled_at",
};

const GUEST_COLUMNS: Record<keyof Guest, string> = {
  id: "id",
  eventId: "event_id",
  name: "name",
  email: "email",
  phone: "phone",
  bio: "bio",
  role: "role",
  status: "status",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const PASS_COLUMNS: Record<keyof Pass, string> = {
  id: "id",
  publicId: "public_id",
  eventId: "event_id",
  guestId: "guest_id",
  secureToken: "secure_token",
  holderName: "holder_name",
  holderRole: "holder_role",
  status: "status",
  issuedAt: "issued_at",
  checkedInAt: "checked_in_at",
  cancelledAt: "cancelled_at",
};

const TIMELINE_COLUMNS: Record<keyof TimelineItem, string> = {
  id: "id",
  eventId: "event_id",
  startTime: "start_time",
  endTime: "end_time",
  title: "title",
  description: "description",
  location: "location",
  sortOrder: "sort_order",
};

const STAFF_COLUMNS: Record<keyof StaffAssignment, string> = {
  id: "id",
  eventId: "event_id",
  userId: "user_id",
  email: "email",
  createdBy: "created_by",
  createdAt: "created_at",
};

const ATTENDANCE_COLUMNS: Record<keyof Attendance, string> = {
  id: "id",
  eventId: "event_id",
  passId: "pass_id",
  guestId: "guest_id",
  checkedInBy: "checked_in_by",
  checkedInAt: "checked_in_at",
  scanType: "scan_type",
  createdAt: "created_at",
};

function toRow<T extends object>(map: Record<keyof T, string>, value: Partial<T>): Row {
  const row: Row = {};
  for (const [key, column] of Object.entries(map) as [keyof T, string][]) {
    if (value[key] !== undefined) row[column] = value[key];
  }
  return row;
}

function fromRow<T extends object>(map: Record<keyof T, string>, row: Row): T {
  const value = {} as Record<string, unknown>;
  for (const [key, column] of Object.entries(map) as [string, string][]) {
    const v = row[column];
    value[key] = typeof v === "string" && /(_at|_datetime|_time)$/.test(column) ? new Date(v).toISOString() : v;
  }
  return value as T;
}

const UNIQUE_FIELDS: [RegExp, string][] = [
  [/public_id/, "public_id"],
  [/slug/, "slug"],
  [/guest_unique|guest_id/, "guest_id"],
  [/token/, "secure_token"],
  [/email/, "email"],
  [/phone/, "phone"],
];

function check(error: { code?: string; message: string; details?: string } | null, context: string): void {
  if (!error) return;
  if (/Maximum event capacity/.test(error.message)) {
    throw new EventError("CAPACITY_REACHED", MESSAGES.capacityReached);
  }
  if (error.code === "23505") {
    const text = `${error.message} ${error.details ?? ""}`;
    const field = UNIQUE_FIELDS.find(([re]) => re.test(text))?.[1] ?? "unknown";
    throw new UniqueViolation(field);
  }
  throw new Error(`${context}: ${error.message}`);
}

/** Supabase (service role) implementation of the Event Management repository. */
export class SupabaseEventRepository implements EventRepository {
  constructor(private sb: SupabaseClient) {}

  async insertEvent(event: ManagedEvent) {
    const { error } = await this.sb.from("em_events").insert(toRow(EVENT_COLUMNS, event));
    check(error, "insert event");
  }

  async updateEvent(id: string, patch: Partial<ManagedEvent>) {
    const { data, error } = await this.sb.from("em_events").update(toRow(EVENT_COLUMNS, patch)).eq("id", id).select("*").single();
    check(error, "update event");
    return fromRow(EVENT_COLUMNS, data as Row);
  }

  async getEvent(id: string) {
    const { data, error } = await this.sb.from("em_events").select("*").eq("id", id).maybeSingle();
    check(error, "get event");
    return data ? fromRow(EVENT_COLUMNS, data as Row) : null;
  }

  async getEventBySlug(slug: string) {
    const { data, error } = await this.sb.from("em_events").select("*").eq("slug", slug).maybeSingle();
    check(error, "get event by slug");
    return data ? fromRow(EVENT_COLUMNS, data as Row) : null;
  }

  async listEventsByOwner(userId: string) {
    const { data, error } = await this.sb.from("em_events").select("*").eq("created_by", userId).order("start_datetime");
    check(error, "list events");
    return ((data as Row[]) ?? []).map((r) => fromRow(EVENT_COLUMNS, r));
  }

  async listEventsByIds(ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await this.sb.from("em_events").select("*").in("id", ids);
    check(error, "list events by id");
    return ((data as Row[]) ?? []).map((r) => fromRow(EVENT_COLUMNS, r));
  }

  async countsForEvents(ids: string[]) {
    const out = new Map<string, RawEventCounts>();
    if (!ids.length) return out;
    const { data, error } = await this.sb.from("em_event_counts").select("*").in("event_id", ids);
    check(error, "event counts");
    for (const r of (data as Row[]) ?? []) {
      out.set(r.event_id as string, {
        invited: Number(r.invited ?? 0),
        cancelled: Number(r.cancelled ?? 0),
        checkedIn: Number(r.checked_in ?? 0),
        passesIssued: Number(r.passes_issued ?? 0),
      });
    }
    return out;
  }

  async listStaff(eventId: string) {
    const { data, error } = await this.sb.from("em_event_staff").select("*").eq("event_id", eventId).order("created_at");
    check(error, "list staff");
    return ((data as Row[]) ?? []).map((r) => fromRow(STAFF_COLUMNS, r));
  }

  async staffEventIds(userId: string, email: string | null) {
    let query = this.sb.from("em_event_staff").select("event_id, user_id, email");
    query = email ? query.or(`user_id.eq.${userId},and(user_id.is.null,email.eq.${JSON.stringify(email)})`) : query.eq("user_id", userId);
    const { data, error } = await query;
    check(error, "staff events");
    return ((data as Row[]) ?? []).map((r) => r.event_id as string);
  }

  async findStaff(eventId: string, userId: string, email: string | null) {
    const { data, error } = await this.sb.from("em_event_staff").select("*").eq("event_id", eventId);
    check(error, "find staff");
    const rows = ((data as Row[]) ?? []).map((r) => fromRow(STAFF_COLUMNS, r));
    return rows.find((s) => s.userId === userId) ?? rows.find((s) => !s.userId && email !== null && s.email === email) ?? null;
  }

  async insertStaff(staff: StaffAssignment) {
    const { error } = await this.sb.from("em_event_staff").insert(toRow(STAFF_COLUMNS, staff));
    check(error, "insert staff");
  }

  async bindStaffUser(staffId: string, userId: string) {
    const { error } = await this.sb.from("em_event_staff").update({ user_id: userId }).eq("id", staffId).is("user_id", null);
    check(error, "bind staff");
  }

  async deleteStaff(eventId: string, staffId: string) {
    const { data, error } = await this.sb.from("em_event_staff").delete().eq("event_id", eventId).eq("id", staffId).select("id");
    check(error, "delete staff");
    return ((data as Row[]) ?? []).length > 0;
  }

  async listTimeline(eventId: string) {
    const { data, error } = await this.sb.from("em_event_timeline").select("*").eq("event_id", eventId).order("sort_order");
    check(error, "list timeline");
    return ((data as Row[]) ?? []).map((r) => fromRow(TIMELINE_COLUMNS, r));
  }

  async replaceTimeline(eventId: string, items: TimelineItem[]) {
    const { error: delErr } = await this.sb.from("em_event_timeline").delete().eq("event_id", eventId);
    check(delErr, "clear timeline");
    if (!items.length) return;
    const { error } = await this.sb.from("em_event_timeline").insert(items.map((i) => toRow(TIMELINE_COLUMNS, i)));
    check(error, "insert timeline");
  }

  async listGuests(eventId: string) {
    const out: Guest[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb
        .from("em_event_guests")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at")
        .order("id")
        .range(from, from + 999);
      check(error, "list guests");
      const rows = (data as Row[]) ?? [];
      out.push(...rows.map((r) => fromRow(GUEST_COLUMNS, r)));
      if (rows.length < 1000) return out;
    }
  }

  async getGuest(id: string) {
    const { data, error } = await this.sb.from("em_event_guests").select("*").eq("id", id).maybeSingle();
    check(error, "get guest");
    return data ? fromRow(GUEST_COLUMNS, data as Row) : null;
  }

  async insertGuests(guests: Guest[]) {
    for (let i = 0; i < guests.length; i += 500) {
      const { error } = await this.sb.from("em_event_guests").insert(guests.slice(i, i + 500).map((g) => toRow(GUEST_COLUMNS, g)));
      check(error, "insert guests");
    }
  }

  async updateGuest(id: string, patch: Partial<Guest>) {
    const { data, error } = await this.sb.from("em_event_guests").update(toRow(GUEST_COLUMNS, patch)).eq("id", id).select("*").single();
    check(error, "update guest");
    return fromRow(GUEST_COLUMNS, data as Row);
  }

  async deleteGuest(id: string) {
    const { error } = await this.sb.from("em_event_guests").delete().eq("id", id);
    check(error, "delete guest");
  }

  async listPasses(eventId: string) {
    const out: Pass[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb
        .from("em_event_passes")
        .select("*")
        .eq("event_id", eventId)
        .order("issued_at")
        .order("id")
        .range(from, from + 999);
      check(error, "list passes");
      const rows = (data as Row[]) ?? [];
      out.push(...rows.map((r) => fromRow(PASS_COLUMNS, r)));
      if (rows.length < 1000) return out;
    }
  }

  private async passBy(column: string, value: string) {
    const { data, error } = await this.sb.from("em_event_passes").select("*").eq(column, value).maybeSingle();
    check(error, "get pass");
    return data ? fromRow(PASS_COLUMNS, data as Row) : null;
  }

  getPassByToken(token: string) {
    return this.passBy("secure_token", token);
  }

  getPassByPublicId(publicId: string) {
    return this.passBy("public_id", publicId);
  }

  getPassByGuest(guestId: string) {
    return this.passBy("guest_id", guestId);
  }

  async insertPasses(passes: Pass[]) {
    const { error } = await this.sb.from("em_event_passes").insert(passes.map((p) => toRow(PASS_COLUMNS, p)));
    check(error, "insert passes");
  }

  async updatePass(id: string, patch: Partial<Pass>) {
    const { data, error } = await this.sb.from("em_event_passes").update(toRow(PASS_COLUMNS, patch)).eq("id", id).select("*").single();
    check(error, "update pass");
    return fromRow(PASS_COLUMNS, data as Row);
  }

  async recordCheckIn(input: CheckInWrite): Promise<CheckInWriteResult> {
    const { data, error } = await this.sb.rpc("em_record_check_in", {
      p_attendance_id: input.attendanceId,
      p_pass_id: input.passId,
      p_event_id: input.eventId,
      p_guest_id: input.guestId,
      p_checked_in_by: input.checkedInBy,
      p_at: input.at,
    });
    if (error?.code === "23505") {
      const pass = await this.passBy("id", input.passId);
      return { recorded: false, checkedInAt: pass?.checkedInAt ?? null };
    }
    check(error, "record check-in");
    const row = ((data as Row[]) ?? [])[0] ?? {};
    const checkedInAt = row.checked_in_at ? new Date(row.checked_in_at as string).toISOString() : null;
    if (!row.recorded) return { recorded: false, checkedInAt };
    return {
      recorded: true,
      attendance: {
        id: input.attendanceId,
        eventId: input.eventId,
        passId: input.passId,
        guestId: input.guestId,
        checkedInBy: input.checkedInBy,
        checkedInAt: checkedInAt ?? input.at,
        scanType: "CHECK_IN",
        createdAt: input.at,
      },
    };
  }

  async listAttendance(eventId: string, limit: number) {
    const { data, error } = await this.sb
      .from("em_attendance")
      .select("*")
      .eq("event_id", eventId)
      .order("checked_in_at", { ascending: false })
      .limit(limit);
    check(error, "list attendance");
    return ((data as Row[]) ?? []).map((r) => fromRow(ATTENDANCE_COLUMNS, r));
  }

  async hasAttendance(guestId: string) {
    const { count, error } = await this.sb.from("em_attendance").select("id", { count: "exact", head: true }).eq("guest_id", guestId);
    check(error, "has attendance");
    return (count ?? 0) > 0;
  }

  async audit(entry: AuditEntry) {
    const { error } = await this.sb.from("em_audit_log").insert({
      id: entry.id,
      event_id: entry.eventId,
      actor_user_id: entry.actorUserId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      result: entry.result,
      ip: entry.ip,
      request_id: entry.requestId,
      metadata: entry.metadata,
      created_at: entry.createdAt,
    });
    if (error) console.warn(JSON.stringify({ msg: "em_audit_failed", error: error.message }));
  }

  /** Fail closed: verification endpoints must not run unthrottled if the limiter is down. */
  async hitRateLimit(key: string, limit: number, windowSeconds: number) {
    const { data, error } = await this.sb.rpc("em_rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error(JSON.stringify({ msg: "em_rate_limit_failed", error: error.message }));
      return false;
    }
    return data === true;
  }
}
