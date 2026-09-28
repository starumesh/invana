import { EventError, MESSAGES, type FieldErrors } from "./errors.ts";
import { eventPublicId, eventSlug, normalizePassPublicId, passPublicId, RESERVED_SLUGS, secureToken, slugify, uuid } from "./ids.ts";
import { decodeQrPayload, encodeQrPayload, isUuid } from "./qrPayload.ts";
import { UniqueViolation, type EventRepository, type RawEventCounts } from "./repository.ts";
import { acceptsCheckIn, canTransitionEvent, canTransitionPass, isEditable } from "./status.ts";
import type {
  Actor,
  AttendanceFilter,
  AttendanceRow,
  AttendanceView,
  CheckInResult,
  EventDetail,
  EventDetailsInput,
  EventStats,
  EventStatus,
  EventSummary,
  Guest,
  GuestInput,
  GuestPassView,
  GuestWithPass,
  ManagedEvent,
  Pass,
  PublicEventView,
  RequestContext,
  StaffAssignment,
  StaffSearchResult,
  TimelineInput,
  TimelineItem,
} from "./types.ts";
import {
  DEFAULT_MAX_CAPACITY_LIMIT,
  findDuplicateKey,
  guestIdentityKeys,
  normalizeEmail,
  validateEventDetails,
  validateGuest,
  validateTimeline,
  type GuestValue,
  type TimelineValue,
} from "./validation.ts";

export type ServiceOptions = {
  maxCapacityLimit?: number;
  now?: () => Date;
  /** Max guests per pass-generation batch (keeps each request short for large lists). */
  passBatchSize?: number;
};

export type CreateEventInput = {
  details: EventDetailsInput;
  timeline?: TimelineInput[];
  guests?: GuestInput[];
};

const RATE = {
  checkIn: { limit: 240, windowSeconds: 60 },
  checkInFailures: { limit: 40, windowSeconds: 60 },
  staffSearch: { limit: 90, windowSeconds: 60 },
  publicPass: { limit: 60, windowSeconds: 60 },
  publicPassMisses: { limit: 15, windowSeconds: 300 },
  publicEvent: { limit: 120, windowSeconds: 60 },
} as const;

const CHECK_IN_COPY = {
  INVALID: {
    title: "Invalid Pass",
    message: "This pass could not be verified. Please scan a valid Invana event pass.",
  },
  CANCELLED: { title: "Pass Cancelled", message: "This pass is no longer valid." },
  WRONG_EVENT: { title: "Wrong Event", message: "This pass does not belong to this event." },
  ALREADY_CHECKED_IN: { title: "Already Checked In", message: MESSAGES.alreadyCheckedIn },
  EVENT_NOT_ACTIVE: {
    title: "Check-in Closed",
    message: "Check-in is only available while the event is published.",
  },
  CHECKED_IN: { title: "Checked In", message: "Welcome! Attendance recorded." },
} as const;

function maskEmail(email: string): string {
  if (!email) return "";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}•••@${domain ?? ""}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "";
}

function statsFrom(event: ManagedEvent, counts: RawEventCounts | undefined): EventStats {
  const c = counts ?? { invited: 0, cancelled: 0, checkedIn: 0, passesIssued: 0 };
  const active = c.invited;
  return {
    maxCapacity: event.maxCapacity,
    invited: active,
    checkedIn: c.checkedIn,
    notCheckedIn: Math.max(0, active - c.checkedIn),
    cancelled: c.cancelled,
    passesIssued: c.passesIssued,
    passesPending: Math.max(0, active - c.passesIssued),
    attendancePercent: active ? Math.round((c.checkedIn / active) * 1000) / 10 : 0,
  };
}

export function countsFrom(guests: Guest[], passes: Pass[]): RawEventCounts {
  const cancelledGuests = new Set(guests.filter((g) => g.status === "CANCELLED").map((g) => g.id));
  return {
    invited: guests.length - cancelledGuests.size,
    cancelled: cancelledGuests.size,
    checkedIn: guests.filter((g) => g.status === "CHECKED_IN").length,
    passesIssued: passes.filter((p) => p.status !== "CANCELLED" && !cancelledGuests.has(p.guestId)).length,
  };
}

export class EventService {
  private repo: EventRepository;
  private maxCapacityLimit: number;
  private now: () => Date;
  private passBatchSize: number;

  constructor(repo: EventRepository, opts: ServiceOptions = {}) {
    this.repo = repo;
    this.maxCapacityLimit = opts.maxCapacityLimit ?? DEFAULT_MAX_CAPACITY_LIMIT;
    this.now = opts.now ?? (() => new Date());
    this.passBatchSize = opts.passBatchSize ?? 50;
  }

  get capacityLimit(): number {
    return this.maxCapacityLimit;
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  // -------------------------------------------------------------------------
  // Authorization + audit helpers
  // -------------------------------------------------------------------------

  private requireActor(ctx: RequestContext): Actor {
    if (!ctx.actor?.userId) throw new EventError("UNAUTHORIZED", MESSAGES.unauthorized);
    return ctx.actor;
  }

  private async audit(
    ctx: RequestContext,
    action: string,
    opts: {
      eventId?: string | null;
      targetType?: string;
      targetId?: string | null;
      result?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ) {
    try {
      await this.repo.audit({
        id: uuid(),
        eventId: opts.eventId ?? null,
        actorUserId: ctx.actor?.userId ?? null,
        action,
        targetType: opts.targetType ?? null,
        targetId: opts.targetId ?? null,
        result: opts.result ?? "OK",
        ip: ctx.ip || null,
        requestId: ctx.requestId || null,
        metadata: opts.metadata ?? {},
        createdAt: this.nowIso(),
      });
    } catch {
      /* audit must never break the user flow */
    }
  }

  private async rateLimit(key: string, rule: { limit: number; windowSeconds: number }) {
    const allowed = await this.repo.hitRateLimit(key, rule.limit, rule.windowSeconds);
    if (!allowed) throw new EventError("RATE_LIMITED", MESSAGES.rateLimited);
  }

  /** Unknown and not-owned events are indistinguishable to callers (anti-enumeration). */
  private async loadOwned(ctx: RequestContext, eventId: string): Promise<ManagedEvent> {
    const actor = this.requireActor(ctx);
    const event = isUuid(eventId) ? await this.repo.getEvent(eventId) : null;
    if (!event || event.createdBy !== actor.userId) {
      await this.audit(ctx, "event.access_denied", { eventId: event?.id ?? null, result: "DENIED" });
      throw new EventError("FORBIDDEN", MESSAGES.forbidden);
    }
    return event;
  }

  private async loadForStaff(
    ctx: RequestContext,
    eventId: string,
  ): Promise<{ event: ManagedEvent; access: "ORGANIZER" | "STAFF" }> {
    const actor = this.requireActor(ctx);
    const event = isUuid(eventId) ? await this.repo.getEvent(eventId) : null;
    if (event && event.createdBy === actor.userId) return { event, access: "ORGANIZER" };
    if (event) {
      const email = actor.email ? normalizeEmail(actor.email) : null;
      const staff = await this.repo.findStaff(event.id, actor.userId, email);
      if (staff) {
        if (!staff.userId) await this.repo.bindStaffUser(staff.id, actor.userId);
        return { event, access: "STAFF" };
      }
    }
    await this.audit(ctx, "event.access_denied", { eventId: event?.id ?? null, result: "DENIED" });
    throw new EventError("FORBIDDEN", MESSAGES.forbidden);
  }

  private async stats(event: ManagedEvent): Promise<EventStats> {
    const counts = await this.repo.countsForEvents([event.id]);
    return statsFrom(event, counts.get(event.id));
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  async listMyEvents(ctx: RequestContext): Promise<EventSummary[]> {
    const actor = this.requireActor(ctx);
    const owned = await this.repo.listEventsByOwner(actor.userId);
    const staffIds = await this.repo.staffEventIds(actor.userId, actor.email ? normalizeEmail(actor.email) : null);
    const ownedIds = new Set(owned.map((e) => e.id));
    const staffEvents = await this.repo.listEventsByIds(staffIds.filter((id) => !ownedIds.has(id)));
    const all = [...owned, ...staffEvents.filter((e) => e.status !== "DRAFT")];
    const counts = await this.repo.countsForEvents(all.map((e) => e.id));
    return all
      .map((event) => ({
        event,
        stats: statsFrom(event, counts.get(event.id)),
        access: ownedIds.has(event.id) ? ("ORGANIZER" as const) : ("STAFF" as const),
      }))
      .sort((a, b) => a.event.startDatetime.localeCompare(b.event.startDatetime));
  }

  async createEvent(ctx: RequestContext, input: CreateEventInput): Promise<EventDetail> {
    const actor = this.requireActor(ctx);
    const details = validateEventDetails(input.details ?? {}, {
      maxCapacityLimit: this.maxCapacityLimit,
      now: this.now(),
      requireFuture: true,
    });
    if (!details.ok) {
      throw new EventError("VALIDATION", MESSAGES.createFailed, { fieldErrors: details.errors });
    }
    const timeline = validateTimeline(input.timeline ?? [], details.value);
    if (!timeline.ok) {
      throw new EventError("VALIDATION", timeline.message, { details: { timeline: timeline.errors } });
    }
    const guests = this.validateGuestBatch(input.guests ?? [], [], details.value.maxCapacity);

    const now = this.nowIso();
    const id = uuid();
    const event: ManagedEvent = {
      id,
      publicId: "",
      ...details.value,
      status: "DRAFT",
      slug: null,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      cancelledAt: null,
    };
    const year = Number(details.value.startDatetime.slice(0, 4));
    for (let attempt = 0; ; attempt += 1) {
      event.publicId = eventPublicId(year);
      try {
        await this.repo.insertEvent(event);
        break;
      } catch (err) {
        if (err instanceof UniqueViolation && err.field === "public_id" && attempt < 5) continue;
        throw err;
      }
    }

    await this.repo.replaceTimeline(id, this.timelineRows(id, timeline.value));
    if (guests.length) await this.insertGuestRows(this.guestRows(id, guests));
    await this.audit(ctx, "event.create", {
      eventId: id,
      targetType: "event",
      targetId: id,
      metadata: { guests: guests.length, timeline: timeline.value.length },
    });
    return this.getEventDetail(ctx, id);
  }

  async updateEvent(
    ctx: RequestContext,
    eventId: string,
    input: { details?: EventDetailsInput; timeline?: TimelineInput[] },
  ): Promise<EventDetail> {
    const event = await this.loadOwned(ctx, eventId);
    if (!isEditable(event.status)) {
      throw new EventError("INVALID_TRANSITION", `A ${event.status.toLowerCase()} event can no longer be edited.`);
    }
    let window = { startDatetime: event.startDatetime, durationMinutes: event.durationMinutes };
    if (input.details) {
      const details = validateEventDetails(input.details, { maxCapacityLimit: this.maxCapacityLimit });
      if (!details.ok) throw new EventError("VALIDATION", MESSAGES.updateFailed, { fieldErrors: details.errors });
      const counts = await this.repo.countsForEvents([event.id]);
      const invited = counts.get(event.id)?.invited ?? 0;
      if (details.value.maxCapacity < invited) {
        throw new EventError("VALIDATION", MESSAGES.updateFailed, {
          fieldErrors: {
            maxCapacity: `Capacity cannot be lower than the ${invited} guests already invited.`,
          },
        });
      }
      window = details.value;
      const timelineCheck = validateTimeline(
        input.timeline ?? (await this.repo.listTimeline(event.id)),
        window,
      );
      if (!timelineCheck.ok) {
        throw new EventError("VALIDATION", "Timeline entries must fall within the new event duration.", {
          details: { timeline: timelineCheck.errors },
        });
      }
      await this.repo.updateEvent(event.id, { ...details.value, updatedAt: this.nowIso() });
    }
    if (input.timeline) {
      const timeline = validateTimeline(input.timeline, window);
      if (!timeline.ok) throw new EventError("VALIDATION", timeline.message, { details: { timeline: timeline.errors } });
      await this.repo.replaceTimeline(event.id, this.timelineRows(event.id, timeline.value));
      if (!input.details) await this.repo.updateEvent(event.id, { updatedAt: this.nowIso() });
    }
    await this.audit(ctx, "event.update", { eventId: event.id, targetType: "event", targetId: event.id });
    return this.getEventDetail(ctx, event.id);
  }

  async getEventDetail(ctx: RequestContext, eventId: string): Promise<EventDetail> {
    const event = await this.loadOwned(ctx, eventId);
    const [timeline, guests, passes] = await Promise.all([
      this.repo.listTimeline(event.id),
      this.repo.listGuests(event.id),
      this.repo.listPasses(event.id),
    ]);
    const byGuest = new Map(passes.map((p) => [p.guestId, p]));
    const guestViews: GuestWithPass[] = guests.map((g) => {
      const p = byGuest.get(g.id);
      return {
        ...g,
        pass: p ? { id: p.id, publicId: p.publicId, status: p.status, issuedAt: p.issuedAt, checkedInAt: p.checkedInAt } : null,
      };
    });
    return {
      event,
      timeline,
      guests: guestViews,
      stats: statsFrom(event, countsFrom(guests, passes)),
      access: "ORGANIZER",
    };
  }

  async transitionEvent(ctx: RequestContext, eventId: string, to: EventStatus): Promise<ManagedEvent> {
    const event = await this.loadOwned(ctx, eventId);
    if (!canTransitionEvent(event.status, to)) {
      throw new EventError(
        "INVALID_TRANSITION",
        `This event is ${event.status.toLowerCase()} and cannot be moved to ${to.toLowerCase()}.`,
      );
    }
    const now = this.nowIso();
    const patch: Partial<ManagedEvent> = { status: to, updatedAt: now };
    if (to === "PUBLISHED") {
      const timeline = await this.repo.listTimeline(event.id);
      const check = validateTimeline(timeline, event);
      if (!check.ok) throw new EventError("VALIDATION", "Fix the timeline before publishing.");
      patch.publishedAt = now;
      if (!event.slug) patch.slug = await this.allocateSlug(event);
    }
    if (to === "CANCELLED") patch.cancelledAt = now;
    let updated: ManagedEvent;
    try {
      updated = await this.repo.updateEvent(event.id, patch);
    } catch (err) {
      if (err instanceof UniqueViolation && err.field === "slug") {
        updated = await this.repo.updateEvent(event.id, { ...patch, slug: await this.allocateSlug(event) });
      } else {
        throw err;
      }
    }
    await this.audit(ctx, `event.${to.toLowerCase()}`, {
      eventId: event.id,
      targetType: "event",
      targetId: event.id,
      metadata: { from: event.status, to },
    });
    return updated;
  }

  private async allocateSlug(event: ManagedEvent): Promise<string> {
    for (let i = 0; i < 6; i += 1) {
      const slug = eventSlug(event.name, event.startDatetime);
      if (RESERVED_SLUGS.has(slug)) continue;
      if (!(await this.repo.getEventBySlug(slug))) return slug;
    }
    throw new EventError("SLUG_TAKEN", "Unable to generate a public link. Please try again.");
  }

  // -------------------------------------------------------------------------
  // Guests
  // -------------------------------------------------------------------------

  private validateGuestBatch(inputs: GuestInput[], existing: Guest[], maxCapacity: number): GuestValue[] {
    if (!Array.isArray(inputs)) throw new EventError("VALIDATION", "Guests must be a list.");
    const seen = new Set<string>();
    for (const g of existing) if (g.status !== "CANCELLED") for (const k of guestIdentityKeys(g)) seen.add(k);
    const active = existing.filter((g) => g.status !== "CANCELLED").length;
    const rowErrors: { index: number; errors: FieldErrors }[] = [];
    const values: GuestValue[] = [];
    inputs.forEach((raw, index) => {
      const result = validateGuest(raw ?? {});
      if (!result.ok) {
        rowErrors.push({ index, errors: result.errors });
        return;
      }
      if (findDuplicateKey(result.value, seen)) {
        rowErrors.push({ index, errors: { name: MESSAGES.duplicateGuest } });
        return;
      }
      for (const k of guestIdentityKeys(result.value)) seen.add(k);
      values.push(result.value);
    });
    if (rowErrors.length) {
      const onlyDuplicates = rowErrors.every((r) => r.errors.name === MESSAGES.duplicateGuest);
      throw new EventError(
        onlyDuplicates ? "DUPLICATE_GUEST" : "VALIDATION",
        onlyDuplicates ? MESSAGES.duplicateGuest : "Some guests have invalid details.",
        { details: { guests: rowErrors } },
      );
    }
    if (active + values.length > maxCapacity) {
      throw new EventError("CAPACITY_REACHED", MESSAGES.capacityReached, {
        details: { maxCapacity, current: active, requested: values.length },
      });
    }
    return values;
  }

  private guestRows(eventId: string, values: GuestValue[]): Guest[] {
    const now = this.nowIso();
    return values.map((v) => ({
      id: uuid(),
      eventId,
      ...v,
      status: "INVITED",
      createdAt: now,
      updatedAt: now,
    }));
  }

  private timelineRows(eventId: string, items: TimelineValue[]): TimelineItem[] {
    return items.map((item, index) => ({
      id: item.id && isUuid(item.id) ? item.id : uuid(),
      eventId,
      startTime: item.startTime,
      endTime: item.endTime,
      title: item.title,
      description: item.description,
      location: item.location,
      sortOrder: index,
    }));
  }

  private async insertGuestRows(rows: Guest[]) {
    try {
      await this.repo.insertGuests(rows);
    } catch (err) {
      if (err instanceof UniqueViolation) throw new EventError("DUPLICATE_GUEST", MESSAGES.duplicateGuest);
      throw err;
    }
  }

  async addGuests(ctx: RequestContext, eventId: string, inputs: GuestInput[]): Promise<Guest[]> {
    const event = await this.loadOwned(ctx, eventId);
    if (!isEditable(event.status)) throw new EventError("INVALID_TRANSITION", "Guests can't be added to this event.");
    const existing = await this.repo.listGuests(event.id);
    const values = this.validateGuestBatch(inputs, existing, event.maxCapacity);
    const rows = this.guestRows(event.id, values);
    if (rows.length) await this.insertGuestRows(rows);
    await this.audit(ctx, "guest.add", { eventId: event.id, targetType: "guest", metadata: { count: rows.length } });
    return rows;
  }

  async updateGuest(ctx: RequestContext, eventId: string, guestId: string, input: GuestInput): Promise<Guest> {
    const event = await this.loadOwned(ctx, eventId);
    const guests = await this.repo.listGuests(event.id);
    const guest = guests.find((g) => g.id === guestId);
    if (!guest) throw new EventError("NOT_FOUND", "This guest could not be found.");
    const result = validateGuest(input);
    if (!result.ok) throw new EventError("VALIDATION", "Please fix the guest details.", { fieldErrors: result.errors });
    const others = new Set<string>();
    for (const g of guests) if (g.id !== guestId && g.status !== "CANCELLED") for (const k of guestIdentityKeys(g)) others.add(k);
    if (findDuplicateKey(result.value, others)) throw new EventError("DUPLICATE_GUEST", MESSAGES.duplicateGuest);
    const updated = await this.repo.updateGuest(guestId, { ...result.value, updatedAt: this.nowIso() }).catch((err) => {
      if (err instanceof UniqueViolation) throw new EventError("DUPLICATE_GUEST", MESSAGES.duplicateGuest);
      throw err;
    });
    await this.audit(ctx, "guest.update", { eventId: event.id, targetType: "guest", targetId: guestId });
    return updated;
  }

  /** Hard-delete unless the guest already attended; then cancel to preserve attendance history. */
  async removeGuest(ctx: RequestContext, eventId: string, guestId: string): Promise<{ removed: "DELETED" | "CANCELLED" }> {
    const event = await this.loadOwned(ctx, eventId);
    const guest = await this.repo.getGuest(guestId);
    if (!guest || guest.eventId !== event.id) throw new EventError("NOT_FOUND", "This guest could not be found.");
    const pass = await this.repo.getPassByGuest(guest.id);
    if (await this.repo.hasAttendance(guest.id)) {
      await this.repo.updateGuest(guest.id, { status: "CANCELLED", updatedAt: this.nowIso() });
      if (pass) await this.repo.updatePass(pass.id, { status: "CANCELLED", cancelledAt: this.nowIso() });
      await this.audit(ctx, "guest.cancel", { eventId: event.id, targetType: "guest", targetId: guest.id });
      return { removed: "CANCELLED" };
    }
    await this.repo.deleteGuest(guest.id);
    await this.audit(ctx, "guest.remove", { eventId: event.id, targetType: "guest", targetId: guest.id });
    return { removed: "DELETED" };
  }

  // -------------------------------------------------------------------------
  // Passes
  // -------------------------------------------------------------------------

  /**
   * Issue passes for up to one batch of guests that don't have one yet. Clients loop until
   * `pending === 0`, which keeps each request short and lets the UI show "87 / 100 generated".
   */
  async generatePasses(
    ctx: RequestContext,
    eventId: string,
    opts: { batchSize?: number } = {},
  ): Promise<{ generated: number; issued: number; total: number; pending: number }> {
    const event = await this.loadOwned(ctx, eventId);
    if (!isEditable(event.status)) throw new EventError("INVALID_TRANSITION", MESSAGES.passGenerationFailed);
    const batch = Math.min(Math.max(1, Math.floor(opts.batchSize ?? this.passBatchSize)), 200);
    const [guests, passes] = await Promise.all([this.repo.listGuests(event.id), this.repo.listPasses(event.id)]);
    const withPass = new Set(passes.map((p) => p.guestId));
    const eligible = guests.filter((g) => g.status !== "CANCELLED");
    const todo = eligible.filter((g) => !withPass.has(g.id)).slice(0, batch);
    const now = this.nowIso();
    const rows: Pass[] = todo.map((g) => ({
      id: uuid(),
      publicId: passPublicId(),
      eventId: event.id,
      guestId: g.id,
      secureToken: secureToken(),
      status: "ISSUED",
      issuedAt: now,
      checkedInAt: null,
      cancelledAt: null,
    }));
    try {
      if (rows.length) await this.repo.insertPasses(rows);
    } catch (err) {
      if (err instanceof UniqueViolation && err.field === "public_id") {
        for (const r of rows) r.publicId = passPublicId();
        await this.repo.insertPasses(rows).catch(() => {
          throw new EventError("PASS_GENERATION_FAILED", MESSAGES.passGenerationFailed);
        });
      } else if (err instanceof UniqueViolation && err.field === "guest_id") {
        /* a concurrent batch already issued these — the next loop recomputes pending */
      } else {
        throw new EventError("PASS_GENERATION_FAILED", MESSAGES.passGenerationFailed);
      }
    }
    const activePasses = passes.filter((p) => eligible.some((g) => g.id === p.guestId)).length + rows.length;
    if (rows.length) {
      await this.audit(ctx, "pass.generate", { eventId: event.id, targetType: "pass", metadata: { count: rows.length } });
    }
    return {
      generated: rows.length,
      issued: activePasses,
      total: eligible.length,
      pending: Math.max(0, eligible.length - activePasses),
    };
  }

  private async ownedPass(ctx: RequestContext, eventId: string, passId: string) {
    const event = await this.loadOwned(ctx, eventId);
    const passes = await this.repo.listPasses(event.id);
    const pass = passes.find((p) => p.id === passId);
    if (!pass) throw new EventError("NOT_FOUND", MESSAGES.invalidPass);
    return { event, pass };
  }

  async cancelPass(ctx: RequestContext, eventId: string, passId: string): Promise<Pass> {
    const { event, pass } = await this.ownedPass(ctx, eventId, passId);
    if (!canTransitionPass(pass.status, "CANCELLED")) throw new EventError("INVALID_TRANSITION", "This pass is already cancelled.");
    const updated = await this.repo.updatePass(pass.id, { status: "CANCELLED", cancelledAt: this.nowIso() });
    await this.repo.updateGuest(pass.guestId, { status: "CANCELLED", updatedAt: this.nowIso() });
    await this.audit(ctx, "pass.cancel", { eventId: event.id, targetType: "pass", targetId: pass.id });
    return updated;
  }

  /** Rotate the secret token (old links and QR codes stop working) and re-activate. */
  async reissuePass(ctx: RequestContext, eventId: string, passId: string): Promise<Pass> {
    const { event, pass } = await this.ownedPass(ctx, eventId, passId);
    if (pass.status === "CHECKED_IN") throw new EventError("INVALID_TRANSITION", MESSAGES.alreadyCheckedIn);
    const guests = await this.repo.listGuests(event.id);
    const guest = guests.find((g) => g.id === pass.guestId);
    if (guest?.status === "CANCELLED") {
      const active = guests.filter((g) => g.status !== "CANCELLED").length;
      if (active + 1 > event.maxCapacity) throw new EventError("CAPACITY_REACHED", MESSAGES.capacityReached);
      await this.repo.updateGuest(pass.guestId, { status: "INVITED", updatedAt: this.nowIso() });
    }
    const updated = await this.repo.updatePass(pass.id, {
      status: "ISSUED",
      secureToken: secureToken(),
      issuedAt: this.nowIso(),
      cancelledAt: null,
    });
    await this.audit(ctx, "pass.reissue", { eventId: event.id, targetType: "pass", targetId: pass.id });
    return updated;
  }

  /** Organizer-only: the guest's private pass link (never exposed in list responses). */
  async sharePass(ctx: RequestContext, eventId: string, guestId: string): Promise<{ passToken: string; passPublicId: string; guestName: string; phone: string; email: string }> {
    const event = await this.loadOwned(ctx, eventId);
    const guest = await this.repo.getGuest(guestId);
    if (!guest || guest.eventId !== event.id) throw new EventError("NOT_FOUND", "This guest could not be found.");
    const pass = await this.repo.getPassByGuest(guest.id);
    if (!pass) throw new EventError("NOT_FOUND", "Generate a pass for this guest first.");
    if (pass.status === "CANCELLED") throw new EventError("INVALID_TRANSITION", "This pass is cancelled. Reissue it before sharing.");
    await this.audit(ctx, "pass.share", { eventId: event.id, targetType: "pass", targetId: pass.id });
    return { passToken: pass.secureToken, passPublicId: pass.publicId, guestName: guest.name, phone: guest.phone, email: guest.email };
  }

  /** Organizer-only bulk export of pass links for mail-merge / bulk messaging. */
  async exportPassLinks(ctx: RequestContext, eventId: string): Promise<{ name: string; email: string; phone: string; role: string; passPublicId: string; passToken: string; status: string }[]> {
    const event = await this.loadOwned(ctx, eventId);
    const [guests, passes] = await Promise.all([this.repo.listGuests(event.id), this.repo.listPasses(event.id)]);
    const byGuest = new Map(passes.map((p) => [p.guestId, p]));
    await this.audit(ctx, "pass.export", { eventId: event.id, targetType: "pass", metadata: { count: passes.length } });
    return guests
      .filter((g) => byGuest.has(g.id))
      .map((g) => {
        const p = byGuest.get(g.id)!;
        return { name: g.name, email: g.email, phone: g.phone, role: g.role, passPublicId: p.publicId, passToken: p.secureToken, status: p.status };
      });
  }

  // -------------------------------------------------------------------------
  // Public surfaces (anonymous, rate-limited, no PII)
  // -------------------------------------------------------------------------

  private publicEventCore(event: ManagedEvent) {
    return {
      publicId: event.publicId,
      name: event.name,
      description: event.description,
      eventType: event.eventType,
      startDatetime: event.startDatetime,
      timezone: event.timezone,
      durationMinutes: event.durationMinutes,
      venueName: event.venueName,
      address: event.address,
      city: event.city,
      state: event.state,
      country: event.country,
      latitude: event.latitude,
      longitude: event.longitude,
      status: event.status,
    };
  }

  async getPublicEvent(ctx: RequestContext, slug: string): Promise<PublicEventView> {
    await this.rateLimit(`em:public-event:${ctx.ip}`, RATE.publicEvent);
    const key = slugify(slug);
    const event = key ? await this.repo.getEventBySlug(key) : null;
    if (!event || event.status === "DRAFT" || !event.slug) throw new EventError("NOT_FOUND", MESSAGES.eventNotFound);
    const [timeline, guests] = await Promise.all([this.repo.listTimeline(event.id), this.repo.listGuests(event.id)]);
    const active = guests.filter((g) => g.status !== "CANCELLED");
    const featured = event.showSpeakers
      ? active
          .filter((g) => g.role === "SPEAKER" || g.role === "HOST")
          .map((g) => ({ name: g.name, role: g.role, ...(event.showGuestBios && g.bio ? { bio: g.bio } : {}) }))
      : [];
    return {
      ...this.publicEventCore(event),
      slug: event.slug,
      maxCapacity: event.maxCapacity,
      timeline: timeline.map(({ eventId: _e, ...rest }) => rest),
      featuredGuests: featured,
      registeredCount: active.length,
    };
  }

  /** A guest's own pass, addressed only by its unguessable token. */
  async getGuestPass(ctx: RequestContext, token: string): Promise<GuestPassView> {
    await this.rateLimit(`em:public-pass:${ctx.ip}`, RATE.publicPass);
    const pass = typeof token === "string" && token.length === 43 ? await this.repo.getPassByToken(token) : null;
    const event = pass ? await this.repo.getEvent(pass.eventId) : null;
    const guest = pass ? await this.repo.getGuest(pass.guestId) : null;
    if (!pass || !event || !guest) {
      await this.rateLimit(`em:public-pass-miss:${ctx.ip}`, RATE.publicPassMisses);
      throw new EventError("NOT_FOUND", MESSAGES.passNotFound);
    }
    return {
      pass: { publicId: pass.publicId, status: pass.status, issuedAt: pass.issuedAt, checkedInAt: pass.checkedInAt },
      guest: { name: guest.name, role: guest.role },
      event: { ...this.publicEventCore(event), slug: event.status === "DRAFT" ? null : event.slug },
      qrPayload: encodeQrPayload(event.id, pass.secureToken),
    };
  }

  // -------------------------------------------------------------------------
  // Check-in (organizer + assigned staff)
  // -------------------------------------------------------------------------

  async checkInContext(ctx: RequestContext, eventId: string) {
    const { event, access } = await this.loadForStaff(ctx, eventId);
    return {
      access,
      event: { id: event.id, publicId: event.publicId, name: event.name, status: event.status, startDatetime: event.startDatetime, timezone: event.timezone, venueName: event.venueName },
      stats: await this.stats(event),
    };
  }

  async checkIn(
    ctx: RequestContext,
    eventId: string,
    body: { payload?: unknown; passPublicId?: unknown; guestId?: unknown },
  ): Promise<CheckInResult> {
    const actor = this.requireActor(ctx);
    await this.rateLimit(`em:checkin:${actor.userId}:${ctx.ip}`, RATE.checkIn);
    const { event } = await this.loadForStaff(ctx, eventId);

    const fail = async (result: "INVALID" | "WRONG_EVENT" | "CANCELLED" | "EVENT_NOT_ACTIVE", passId?: string) => {
      await this.audit(ctx, "checkin.attempt", { eventId: event.id, targetType: "pass", targetId: passId ?? null, result });
      if (result === "INVALID") await this.rateLimit(`em:checkin-fail:${actor.userId}`, RATE.checkInFailures);
      return { result, ...CHECK_IN_COPY[result], event: { name: event.name } } satisfies CheckInResult;
    };

    let pass: Pass | null = null;
    let method = "qr";
    if (typeof body.payload === "string" && body.payload) {
      const decoded = decodeQrPayload(body.payload);
      if (!decoded) return fail("INVALID");
      pass = await this.repo.getPassByToken(decoded.passToken);
      if (!pass) return fail("INVALID");
      if (decoded.eventId && decoded.eventId !== pass.eventId) return fail("INVALID", pass.id);
    } else if (typeof body.passPublicId === "string" && body.passPublicId) {
      method = "pass_id";
      const normalized = normalizePassPublicId(body.passPublicId);
      pass = normalized ? await this.repo.getPassByPublicId(normalized) : null;
      if (!pass) return fail("INVALID");
    } else if (typeof body.guestId === "string" && body.guestId) {
      method = "guest";
      const guest = isUuid(body.guestId) ? await this.repo.getGuest(body.guestId) : null;
      if (!guest || guest.eventId !== event.id) return fail("INVALID");
      pass = await this.repo.getPassByGuest(guest.id);
      if (!pass) return fail("INVALID");
    } else {
      return fail("INVALID");
    }

    if (pass.eventId !== event.id) return fail("WRONG_EVENT", pass.id);
    if (!acceptsCheckIn(event.status)) return fail("EVENT_NOT_ACTIVE", pass.id);
    const guest = await this.repo.getGuest(pass.guestId);
    if (!guest) return fail("INVALID", pass.id);
    const guestView = { name: guest.name, role: guest.role };
    if (pass.status === "CANCELLED" || guest.status === "CANCELLED") {
      const res = await fail("CANCELLED", pass.id);
      return { ...res, guest: guestView, pass: { publicId: pass.publicId, status: "CANCELLED" } };
    }
    const duplicate = async (checkedInAt: string | null) => {
      await this.audit(ctx, "checkin.attempt", { eventId: event.id, targetType: "pass", targetId: pass!.id, result: "ALREADY_CHECKED_IN", metadata: { method } });
      return {
        result: "ALREADY_CHECKED_IN",
        ...CHECK_IN_COPY.ALREADY_CHECKED_IN,
        guest: guestView,
        pass: { publicId: pass!.publicId, status: "CHECKED_IN" },
        event: { name: event.name },
        checkedInAt: checkedInAt ?? pass!.checkedInAt ?? undefined,
      } satisfies CheckInResult;
    };
    if (pass.status === "CHECKED_IN") return duplicate(pass.checkedInAt);

    const at = this.nowIso();
    const write = await this.repo.recordCheckIn({
      attendanceId: uuid(),
      passId: pass.id,
      eventId: event.id,
      guestId: guest.id,
      checkedInBy: actor.userId,
      at,
    });
    if (!write.recorded) return duplicate(write.checkedInAt);
    await this.audit(ctx, "checkin.attempt", { eventId: event.id, targetType: "pass", targetId: pass.id, result: "CHECKED_IN", metadata: { method } });
    return {
      result: "CHECKED_IN",
      ...CHECK_IN_COPY.CHECKED_IN,
      guest: guestView,
      pass: { publicId: pass.publicId, status: "CHECKED_IN" },
      event: { name: event.name },
      checkedInAt: write.attendance.checkedInAt,
    };
  }

  /** Staff fallback lookup. Returns masked contact details only. */
  async searchGuests(ctx: RequestContext, eventId: string, query: string): Promise<StaffSearchResult[]> {
    const actor = this.requireActor(ctx);
    await this.rateLimit(`em:staff-search:${actor.userId}`, RATE.staffSearch);
    const { event } = await this.loadForStaff(ctx, eventId);
    const q = (query ?? "").trim().toLowerCase();
    if (q.length < 2) return [];
    const [guests, passes] = await Promise.all([this.repo.listGuests(event.id), this.repo.listPasses(event.id)]);
    const byGuest = new Map(passes.map((p) => [p.guestId, p]));
    const digits = q.replace(/\D/g, "");
    const passQuery = normalizePassPublicId(q);
    const matches = guests.filter((g) => {
      const p = byGuest.get(g.id);
      if (passQuery && p?.publicId === passQuery) return true;
      if (g.name.toLowerCase().includes(q)) return true;
      if (g.email && q.includes("@") && g.email.toLowerCase() === q) return true;
      if (g.email && g.email.toLowerCase().startsWith(q) && q.length >= 3) return true;
      if (digits.length >= 4 && digits.length === q.replace(/[\s()+-]/g, "").length && g.phone.replace(/\D/g, "").includes(digits)) return true;
      return false;
    });
    await this.audit(ctx, "checkin.search", { eventId: event.id, metadata: { results: matches.length } });
    return matches.slice(0, 20).map((g) => {
      const p = byGuest.get(g.id);
      return {
        guestId: g.id,
        name: g.name,
        role: g.role,
        maskedEmail: maskEmail(g.email),
        maskedPhone: maskPhone(g.phone),
        passPublicId: p?.publicId ?? null,
        passStatus: p?.status ?? null,
        checkedInAt: p?.checkedInAt ?? null,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Attendance (organizer)
  // -------------------------------------------------------------------------

  async getAttendance(
    ctx: RequestContext,
    eventId: string,
    opts: { filter?: AttendanceFilter; q?: string } = {},
  ): Promise<AttendanceView> {
    const event = await this.loadOwned(ctx, eventId);
    const [guests, passes, attendance] = await Promise.all([
      this.repo.listGuests(event.id),
      this.repo.listPasses(event.id),
      this.repo.listAttendance(event.id, 20),
    ]);
    const byGuest = new Map(passes.map((p) => [p.guestId, p]));
    const guestById = new Map(guests.map((g) => [g.id, g]));
    const toRow = (g: Guest): AttendanceRow => {
      const p = byGuest.get(g.id);
      return {
        guestId: g.id,
        name: g.name,
        role: g.role,
        guestStatus: g.status,
        passPublicId: p?.publicId ?? null,
        passStatus: p?.status ?? null,
        checkedInAt: p?.checkedInAt ?? null,
      };
    };
    const filter = opts.filter ?? "ALL";
    const q = (opts.q ?? "").trim().toLowerCase();
    const rows = guests
      .filter((g) => {
        if (filter === "CHECKED_IN") return g.status === "CHECKED_IN";
        if (filter === "NOT_CHECKED_IN") return g.status === "INVITED";
        if (filter === "CANCELLED") return g.status === "CANCELLED";
        return true;
      })
      .filter((g) => {
        if (!q) return true;
        const p = byGuest.get(g.id);
        return g.name.toLowerCase().includes(q) || (p?.publicId.toLowerCase().includes(q) ?? false) || g.email.includes(q) || (q.replace(/\D/g, "").length >= 4 && g.phone.includes(q.replace(/\D/g, "")));
      })
      .map(toRow)
      .sort((a, b) => (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? "") || a.name.localeCompare(b.name));
    const recent = attendance
      .map((a) => {
        const g = guestById.get(a.guestId);
        return g ? { ...toRow(g), checkedInAt: a.checkedInAt } : null;
      })
      .filter((r): r is AttendanceRow & { checkedInAt: string } => Boolean(r));
    return { stats: statsFrom(event, countsFrom(guests, passes)), recent, rows, generatedAt: this.nowIso() };
  }

  // -------------------------------------------------------------------------
  // Staff management (organizer)
  // -------------------------------------------------------------------------

  async listStaff(ctx: RequestContext, eventId: string): Promise<StaffAssignment[]> {
    const event = await this.loadOwned(ctx, eventId);
    return this.repo.listStaff(event.id);
  }

  async addStaff(ctx: RequestContext, eventId: string, emailInput: unknown): Promise<StaffAssignment> {
    const actor = this.requireActor(ctx);
    const event = await this.loadOwned(ctx, eventId);
    const email = typeof emailInput === "string" ? normalizeEmail(emailInput) : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new EventError("VALIDATION", "Enter a valid staff email address.", { fieldErrors: { email: "Enter a valid email address." } });
    }
    if (actor.email && normalizeEmail(actor.email) === email) {
      throw new EventError("VALIDATION", "You already have organizer access to this event.");
    }
    const existing = await this.repo.listStaff(event.id);
    if (existing.some((s) => s.email === email)) throw new EventError("DUPLICATE_GUEST", "This staff member is already assigned to this event.");
    if (existing.length >= 50) throw new EventError("VALIDATION", "An event can have at most 50 staff members.");
    const staff: StaffAssignment = { id: uuid(), eventId: event.id, userId: null, email, createdBy: actor.userId, createdAt: this.nowIso() };
    await this.repo.insertStaff(staff);
    await this.audit(ctx, "staff.add", { eventId: event.id, targetType: "staff", targetId: staff.id });
    return staff;
  }

  async removeStaff(ctx: RequestContext, eventId: string, staffId: string): Promise<void> {
    const event = await this.loadOwned(ctx, eventId);
    const removed = await this.repo.deleteStaff(event.id, staffId);
    if (!removed) throw new EventError("NOT_FOUND", "This staff member could not be found.");
    await this.audit(ctx, "staff.remove", { eventId: event.id, targetType: "staff", targetId: staffId });
  }
}
