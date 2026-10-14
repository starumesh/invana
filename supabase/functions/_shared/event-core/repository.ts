import type {
  Attendance,
  EventListItem,
  GuestQuery,
  GuestRow,
  AuditEntry,
  Guest,
  ManagedEvent,
  Pass,
  StaffAssignment,
  TimelineItem,
} from "./types.ts";

export type RawEventCounts = {
  invited: number;
  cancelled: number;
  checkedIn: number;
  passesIssued: number;
  passesShared: number;
};

export type EventCursor = { createdAt: string; id: string };

export type CheckInWrite = {
  attendanceId: string;
  passId: string;
  eventId: string;
  guestId: string;
  checkedInBy: string;
  at: string;
};

export type CheckInWriteResult =
  | { recorded: true; attendance: Attendance }
  | { recorded: false; checkedInAt: string | null };

export class UniqueViolation extends Error {
  field: string;
  constructor(field: string) {
    super(`unique violation: ${field}`);
    this.name = "UniqueViolation";
    this.field = field;
  }
}

/**
 * Persistence port for the Event Management service. Implementations:
 * `MemoryEventRepository` (tests, Demo Mode) and the Supabase repo in the Edge function.
 * Authorization lives in the service, never here.
 */
export interface EventRepository {
  insertEvent(event: ManagedEvent): Promise<void>;
  updateEvent(id: string, patch: Partial<ManagedEvent>): Promise<ManagedEvent>;
  getEvent(id: string): Promise<ManagedEvent | null>;
  getEventBySlug(slug: string): Promise<ManagedEvent | null>;
  listEventsByOwner(userId: string): Promise<ManagedEvent[]>;
  listEventsByIds(ids: string[]): Promise<ManagedEvent[]>;
  countsForEvents(ids: string[]): Promise<Map<string, RawEventCounts>>;
  /** One round trip for the My Events list: owned + assigned (non-draft) events, newest first. */
  listEventSummaries(input: {
    userId: string;
    email: string | null;
    limit: number;
    cursor: EventCursor | null;
  }): Promise<{ event: EventListItem; counts: RawEventCounts; access: "ORGANIZER" | "STAFF" }[]>;
  /** Filtered, sorted, paginated guest + pass rows (no tokens). */
  queryGuestRows(eventId: string, query: Required<Omit<GuestQuery, "role">> & { role: GuestQuery["role"] }): Promise<{ rows: GuestRow[]; total: number }>;

  listStaff(eventId: string): Promise<StaffAssignment[]>;
  /** Event ids where the user is assigned staff (by bound user id or pending email). */
  staffEventIds(userId: string, email: string | null): Promise<string[]>;
  findStaff(eventId: string, userId: string, email: string | null): Promise<StaffAssignment | null>;
  insertStaff(staff: StaffAssignment): Promise<void>;
  bindStaffUser(staffId: string, userId: string): Promise<void>;
  deleteStaff(eventId: string, staffId: string): Promise<boolean>;

  listTimeline(eventId: string): Promise<TimelineItem[]>;
  replaceTimeline(eventId: string, items: TimelineItem[]): Promise<void>;

  listGuests(eventId: string): Promise<Guest[]>;
  getGuest(id: string): Promise<Guest | null>;
  insertGuests(guests: Guest[]): Promise<void>;
  updateGuest(id: string, patch: Partial<Guest>): Promise<Guest>;
  deleteGuest(id: string): Promise<void>;

  listPasses(eventId: string): Promise<Pass[]>;
  getPassByToken(token: string): Promise<Pass | null>;
  getPassByPublicId(publicId: string): Promise<Pass | null>;
  getPassByGuest(guestId: string): Promise<Pass | null>;
  insertPasses(passes: Pass[]): Promise<void>;
  updatePass(id: string, patch: Partial<Pass>): Promise<Pass>;

  /**
   * Atomically: if the pass is ISSUED, mark it CHECKED_IN, mark the guest CHECKED_IN,
   * and insert one attendance row. Otherwise record nothing and return the original time.
   */
  recordCheckIn(input: CheckInWrite): Promise<CheckInWriteResult>;
  listAttendance(eventId: string, limit: number): Promise<Attendance[]>;
  hasAttendance(guestId: string): Promise<boolean>;

  audit(entry: AuditEntry): Promise<void>;
  /** Returns true when the call is allowed. */
  hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}
