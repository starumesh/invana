import { EventError, MESSAGES } from "./errors.ts";
import { UniqueViolation, type CheckInWrite, type EventCursor, type CheckInWriteResult, type EventRepository, type RawEventCounts } from "./repository.ts";
import { applyGuestQuery } from "./guestQuery.ts";
import { countsFrom, guestStage, passView } from "./service.ts";
import type { Attendance, AuditEntry, EventListItem, GuestQuery, GuestRow, Guest, ManagedEvent, Pass, StaffAssignment, TimelineItem } from "./types.ts";

export type MemorySnapshot = {
  events: ManagedEvent[];
  timeline: TimelineItem[];
  guests: Guest[];
  passes: Pass[];
  attendance: Attendance[];
  staff: StaffAssignment[];
  audit: AuditEntry[];
};

export function emptySnapshot(): MemorySnapshot {
  return { events: [], timeline: [], guests: [], passes: [], attendance: [], staff: [], audit: [] };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * In-memory repository with the same constraints as the Postgres schema
 * (unique public ids / slugs / tokens, one pass per guest, one CHECK_IN per pass).
 * Used by tests and by Demo Mode (persisted to localStorage via `onChange`).
 */
export class MemoryEventRepository implements EventRepository {
  data: MemorySnapshot;
  private buckets: Map<string, number>;
  private onChange?: (data: MemorySnapshot) => void;
  private maxAudit: number;

  constructor(
    initial?: MemorySnapshot,
    opts: { onChange?: (data: MemorySnapshot) => void; maxAudit?: number; buckets?: Map<string, number> } = {},
  ) {
    this.data = initial ? clone(initial) : emptySnapshot();
    this.buckets = opts.buckets ?? new Map();
    this.onChange = opts.onChange;
    this.maxAudit = opts.maxAudit ?? 5000;
  }

  private changed() {
    this.onChange?.(this.data);
  }

  async insertEvent(event: ManagedEvent) {
    if (this.data.events.some((e) => e.publicId === event.publicId)) throw new UniqueViolation("public_id");
    if (event.slug && this.data.events.some((e) => e.slug === event.slug)) throw new UniqueViolation("slug");
    this.data.events.push(clone(event));
    this.changed();
  }

  async updateEvent(id: string, patch: Partial<ManagedEvent>) {
    const index = this.data.events.findIndex((e) => e.id === id);
    if (index < 0) throw new Error("event not found");
    if (patch.slug && this.data.events.some((e) => e.id !== id && e.slug === patch.slug)) throw new UniqueViolation("slug");
    this.data.events[index] = { ...this.data.events[index], ...clone(patch) };
    this.changed();
    return clone(this.data.events[index]);
  }

  async getEvent(id: string) {
    const e = this.data.events.find((x) => x.id === id);
    return e ? clone(e) : null;
  }

  async getEventBySlug(slug: string) {
    const e = this.data.events.find((x) => x.slug === slug);
    return e ? clone(e) : null;
  }

  async listEventsByOwner(userId: string) {
    return clone(this.data.events.filter((e) => e.createdBy === userId));
  }

  async listEventsByIds(ids: string[]) {
    const want = new Set(ids);
    return clone(this.data.events.filter((e) => want.has(e.id)));
  }

  async countsForEvents(ids: string[]) {
    const out = new Map<string, RawEventCounts>();
    for (const id of ids) {
      out.set(
        id,
        countsFrom(
          this.data.guests.filter((g) => g.eventId === id),
          this.data.passes.filter((p) => p.eventId === id),
        ),
      );
    }
    return out;
  }

  async listEventSummaries(input: { userId: string; email: string | null; limit: number; cursor: EventCursor | null }) {
    const staffOf = new Set(
      this.data.staff.filter((s) => s.userId === input.userId || (!s.userId && input.email && s.email === input.email)).map((s) => s.eventId),
    );
    const rows = this.data.events
      .map((e) => ({ e, access: e.createdBy === input.userId ? ("ORGANIZER" as const) : staffOf.has(e.id) && e.status !== "DRAFT" ? ("STAFF" as const) : null }))
      .filter((r): r is { e: (typeof r)["e"]; access: "ORGANIZER" | "STAFF" } => r.access !== null)
      .sort((a, b) => b.e.createdAt.localeCompare(a.e.createdAt) || b.e.id.localeCompare(a.e.id))
      .filter(({ e }) => !input.cursor || e.createdAt < input.cursor.createdAt || (e.createdAt === input.cursor.createdAt && e.id < input.cursor.id))
      .slice(0, input.limit);
    return rows.map(({ e, access }) => {
      const event: EventListItem = {
        id: e.id, publicId: e.publicId, name: e.name, eventType: e.eventType, startDatetime: e.startDatetime, timezone: e.timezone,
        durationMinutes: e.durationMinutes, venueName: e.venueName, city: e.city, status: e.status, slug: e.slug, maxCapacity: e.maxCapacity, createdAt: e.createdAt,
      };
      const counts = countsFrom(this.data.guests.filter((g) => g.eventId === e.id), this.data.passes.filter((p) => p.eventId === e.id));
      return { event: clone(event), counts, access };
    });
  }

  async queryGuestRows(eventId: string, query: Required<Omit<GuestQuery, "role">> & { role: GuestQuery["role"] }) {
    const passes = new Map(this.data.passes.filter((p) => p.eventId === eventId).map((p) => [p.guestId, p]));
    const all: GuestRow[] = this.data.guests
      .filter((g) => g.eventId === eventId)
      .map((g) => {
        const p = passes.get(g.id);
        return { ...clone(g), pass: p ? passView(p) : null, stage: guestStage(g, p) };
      });
    return applyGuestQuery(all, query);
  }

  async listStaff(eventId: string) {
    return clone(this.data.staff.filter((s) => s.eventId === eventId));
  }

  async staffEventIds(userId: string, email: string | null) {
    return this.data.staff.filter((s) => s.userId === userId || (!s.userId && email && s.email === email)).map((s) => s.eventId);
  }

  async findStaff(eventId: string, userId: string, email: string | null) {
    const s = this.data.staff.find(
      (x) => x.eventId === eventId && (x.userId === userId || (!x.userId && email !== null && x.email === email)),
    );
    return s ? clone(s) : null;
  }

  async insertStaff(staff: StaffAssignment) {
    if (this.data.staff.some((s) => s.eventId === staff.eventId && s.email === staff.email)) throw new UniqueViolation("email");
    this.data.staff.push(clone(staff));
    this.changed();
  }

  async bindStaffUser(staffId: string, userId: string) {
    const s = this.data.staff.find((x) => x.id === staffId);
    if (s) s.userId = userId;
    this.changed();
  }

  async deleteStaff(eventId: string, staffId: string) {
    const before = this.data.staff.length;
    this.data.staff = this.data.staff.filter((s) => !(s.eventId === eventId && s.id === staffId));
    this.changed();
    return this.data.staff.length < before;
  }

  async listTimeline(eventId: string) {
    return clone(this.data.timeline.filter((t) => t.eventId === eventId).sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async replaceTimeline(eventId: string, items: TimelineItem[]) {
    this.data.timeline = [...this.data.timeline.filter((t) => t.eventId !== eventId), ...clone(items)];
    this.changed();
  }

  async listGuests(eventId: string) {
    return clone(this.data.guests.filter((g) => g.eventId === eventId));
  }

  async getGuest(id: string) {
    const g = this.data.guests.find((x) => x.id === id);
    return g ? clone(g) : null;
  }

  async insertGuests(guests: Guest[]) {
    for (const g of guests) {
      const event = this.data.events.find((e) => e.id === g.eventId);
      const active = this.data.guests.filter((x) => x.eventId === g.eventId && x.status !== "CANCELLED").length;
      if (event && active + guests.length > event.maxCapacity) throw new EventError("CAPACITY_REACHED", MESSAGES.capacityReached);
    }
    this.data.guests.push(...clone(guests));
    this.changed();
  }

  async updateGuest(id: string, patch: Partial<Guest>) {
    const index = this.data.guests.findIndex((g) => g.id === id);
    if (index < 0) throw new Error("guest not found");
    this.data.guests[index] = { ...this.data.guests[index], ...clone(patch) };
    this.changed();
    return clone(this.data.guests[index]);
  }

  async deleteGuest(id: string) {
    this.data.guests = this.data.guests.filter((g) => g.id !== id);
    const passIds = new Set(this.data.passes.filter((p) => p.guestId === id).map((p) => p.id));
    this.data.passes = this.data.passes.filter((p) => p.guestId !== id);
    this.data.attendance = this.data.attendance.filter((a) => !passIds.has(a.passId));
    this.changed();
  }

  async listPasses(eventId: string) {
    return clone(this.data.passes.filter((p) => p.eventId === eventId));
  }

  async getPassByToken(token: string) {
    const p = this.data.passes.find((x) => x.secureToken === token);
    return p ? clone(p) : null;
  }

  async getPassByPublicId(publicId: string) {
    const p = this.data.passes.find((x) => x.publicId === publicId);
    return p ? clone(p) : null;
  }

  async getPassByGuest(guestId: string) {
    const p = this.data.passes.find((x) => x.guestId === guestId);
    return p ? clone(p) : null;
  }

  async insertPasses(passes: Pass[]) {
    for (const p of passes) {
      if (this.data.passes.some((x) => x.guestId === p.guestId)) throw new UniqueViolation("guest_id");
      if (this.data.passes.some((x) => x.publicId === p.publicId)) throw new UniqueViolation("public_id");
      if (this.data.passes.some((x) => x.secureToken === p.secureToken)) throw new UniqueViolation("secure_token");
    }
    this.data.passes.push(...clone(passes));
    this.changed();
  }

  async updatePass(id: string, patch: Partial<Pass>) {
    const index = this.data.passes.findIndex((p) => p.id === id);
    if (index < 0) throw new Error("pass not found");
    this.data.passes[index] = { ...this.data.passes[index], ...clone(patch) };
    this.changed();
    return clone(this.data.passes[index]);
  }

  async recordCheckIn(input: CheckInWrite): Promise<CheckInWriteResult> {
    const pass = this.data.passes.find((p) => p.id === input.passId && p.eventId === input.eventId);
    if (!pass || pass.status !== "ISSUED") return { recorded: false, checkedInAt: pass?.checkedInAt ?? null };
    if (this.data.attendance.some((a) => a.passId === pass.id && a.scanType === "CHECK_IN")) {
      return { recorded: false, checkedInAt: pass.checkedInAt };
    }
    pass.status = "CHECKED_IN";
    pass.checkedInAt = input.at;
    const guest = this.data.guests.find((g) => g.id === input.guestId);
    if (guest) {
      guest.status = "CHECKED_IN";
      guest.updatedAt = input.at;
    }
    const attendance: Attendance = {
      id: input.attendanceId,
      eventId: input.eventId,
      passId: input.passId,
      guestId: input.guestId,
      checkedInBy: input.checkedInBy,
      checkedInAt: input.at,
      scanType: "CHECK_IN",
      createdAt: input.at,
    };
    this.data.attendance.push(attendance);
    this.changed();
    return { recorded: true, attendance: clone(attendance) };
  }

  async listAttendance(eventId: string, limit: number) {
    return clone(
      this.data.attendance
        .filter((a) => a.eventId === eventId)
        .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
        .slice(0, limit),
    );
  }

  async hasAttendance(guestId: string) {
    return this.data.attendance.some((a) => a.guestId === guestId);
  }

  async audit(entry: AuditEntry) {
    this.data.audit.push(clone(entry));
    if (this.data.audit.length > this.maxAudit) this.data.audit.splice(0, this.data.audit.length - this.maxAudit);
    this.changed();
  }

  async hitRateLimit(key: string, limit: number, windowSeconds: number) {
    const windowStart = Math.floor(Date.now() / (windowSeconds * 1000));
    const bucket = `${key}:${windowStart}`;
    const hits = this.buckets.get(bucket) ?? 0;
    if (hits >= limit) return false;
    this.buckets.set(bucket, hits + 1);
    return true;
  }
}
