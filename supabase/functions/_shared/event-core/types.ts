/**
 * Event Management domain types. Runtime-agnostic (browser, Deno Edge, Node/Vitest):
 * no DOM, Deno, or npm imports anywhere under `event-core/`.
 */

export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const PASS_STATUSES = ["ISSUED", "CHECKED_IN", "CANCELLED"] as const;
export type PassStatus = (typeof PASS_STATUSES)[number];

export const GUEST_STATUSES = ["INVITED", "CHECKED_IN", "CANCELLED"] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

export const GUEST_ROLES = ["GUEST", "SPEAKER", "VIP", "HOST", "AUDIENCE", "STAFF", "OTHER"] as const;
export type GuestRole = (typeof GUEST_ROLES)[number];

export const GUEST_ROLE_LABELS: Record<GuestRole, string> = {
  GUEST: "Guest",
  SPEAKER: "Speaker",
  VIP: "VIP",
  HOST: "Host",
  AUDIENCE: "Audience",
  STAFF: "Worker/Staff",
  OTHER: "Other",
};

/** Stored as free text so new types never need a schema change. */
export const DEFAULT_EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Engagement",
  "Sangeet",
  "Haldi",
  "Gruha Pravesham",
  "Conference",
  "Meetup",
  "Other",
] as const;

export type ManagedEvent = {
  id: string;
  publicId: string;
  name: string;
  description: string;
  eventType: string;
  /** ISO 8601 instant (UTC). */
  startDatetime: string;
  /** IANA zone used for display, e.g. "Asia/Kolkata". */
  timezone: string;
  durationMinutes: number;
  venueName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  status: EventStatus;
  slug: string | null;
  showGuestBios: boolean;
  showSpeakers: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  cancelledAt: string | null;
};

export type TimelineItem = {
  id: string;
  eventId: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  location: string;
  sortOrder: number;
};

export type Guest = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  role: GuestRole;
  status: GuestStatus;
  createdAt: string;
  updatedAt: string;
};

export type Pass = {
  id: string;
  publicId: string;
  eventId: string;
  guestId: string;
  secureToken: string;
  status: PassStatus;
  issuedAt: string;
  checkedInAt: string | null;
  cancelledAt: string | null;
};

export type ScanType = "CHECK_IN" | "RE_ENTRY";

export type Attendance = {
  id: string;
  eventId: string;
  passId: string;
  guestId: string;
  checkedInBy: string;
  checkedInAt: string;
  scanType: ScanType;
  createdAt: string;
};

export type StaffAssignment = {
  id: string;
  eventId: string;
  userId: string | null;
  email: string;
  createdBy: string;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  eventId: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  result: string;
  ip: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type Actor = {
  userId: string;
  email?: string | null;
};

/** Context resolved by the transport (Edge / in-browser) — never from the request body. */
export type RequestContext = {
  actor: Actor | null;
  ip: string;
  requestId: string;
};

// ---------------------------------------------------------------------------
// Inputs (client-supplied, always validated)
// ---------------------------------------------------------------------------

export type EventDetailsInput = {
  name?: unknown;
  description?: unknown;
  eventType?: unknown;
  /** YYYY-MM-DD in `timezone`. */
  date?: unknown;
  /** HH:mm in `timezone`. */
  startTime?: unknown;
  timezone?: unknown;
  durationMinutes?: unknown;
  venueName?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  maxCapacity?: unknown;
  showGuestBios?: unknown;
  showSpeakers?: unknown;
};

export type TimelineInput = {
  id?: unknown;
  /** ISO instant, or HH:mm relative to the event date (see validation). */
  startTime?: unknown;
  endTime?: unknown;
  title?: unknown;
  description?: unknown;
  location?: unknown;
};

export type GuestInput = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  bio?: unknown;
  role?: unknown;
};

// ---------------------------------------------------------------------------
// Views (API responses)
// ---------------------------------------------------------------------------

export type EventStats = {
  maxCapacity: number;
  invited: number;
  checkedIn: number;
  notCheckedIn: number;
  cancelled: number;
  passesIssued: number;
  passesPending: number;
  attendancePercent: number;
};

export type EventSummary = {
  event: ManagedEvent;
  stats: EventStats;
  access: "ORGANIZER" | "STAFF";
};

export type GuestWithPass = Guest & {
  pass: Pick<Pass, "id" | "publicId" | "status" | "issuedAt" | "checkedInAt"> | null;
};

export type EventDetail = {
  event: ManagedEvent;
  timeline: TimelineItem[];
  guests: GuestWithPass[];
  stats: EventStats;
  access: "ORGANIZER" | "STAFF";
};

export type PublicEventView = {
  publicId: string;
  slug: string;
  name: string;
  description: string;
  eventType: string;
  startDatetime: string;
  timezone: string;
  durationMinutes: number;
  venueName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  status: EventStatus;
  timeline: Omit<TimelineItem, "eventId">[];
  featuredGuests: { name: string; role: GuestRole; bio?: string }[];
  registeredCount: number;
};

export type GuestPassView = {
  pass: { publicId: string; status: PassStatus; issuedAt: string; checkedInAt: string | null };
  guest: { name: string; role: GuestRole };
  event: Omit<PublicEventView, "featuredGuests" | "registeredCount" | "timeline" | "slug" | "maxCapacity"> & {
    slug: string | null;
  };
  /** Exact string to encode in the QR code. Contains no PII. */
  qrPayload: string;
};

export type CheckInResultCode =
  | "CHECKED_IN"
  | "ALREADY_CHECKED_IN"
  | "INVALID"
  | "CANCELLED"
  | "WRONG_EVENT"
  | "EVENT_NOT_ACTIVE";

export type CheckInResult = {
  result: CheckInResultCode;
  title: string;
  message: string;
  guest?: { name: string; role: GuestRole };
  pass?: { publicId: string; status: PassStatus };
  event?: { name: string };
  checkedInAt?: string;
};

export type StaffSearchResult = {
  guestId: string;
  name: string;
  role: GuestRole;
  maskedEmail: string;
  maskedPhone: string;
  passPublicId: string | null;
  passStatus: PassStatus | null;
  checkedInAt: string | null;
};

export type AttendanceFilter = "ALL" | "CHECKED_IN" | "NOT_CHECKED_IN" | "CANCELLED";

export type AttendanceRow = {
  guestId: string;
  name: string;
  role: GuestRole;
  guestStatus: GuestStatus;
  passPublicId: string | null;
  passStatus: PassStatus | null;
  checkedInAt: string | null;
};

export type AttendanceView = {
  stats: EventStats;
  recent: (AttendanceRow & { checkedInAt: string })[];
  rows: AttendanceRow[];
  generatedAt: string;
};
