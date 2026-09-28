import type { FieldErrors } from "./errors.ts";
import { isValidTimezone, parseDateParts, parseTimeParts, zonedToUtcIso } from "./time.ts";
import {
  GUEST_ROLE_LABELS,
  GUEST_ROLES,
  type EventDetailsInput,
  type GuestInput,
  type GuestRole,
  type TimelineInput,
} from "./types.ts";

export const DEFAULT_MAX_CAPACITY_LIMIT = 10_000;
export const MAX_DURATION_MINUTES = 60 * 24 * 14;
export const MAX_TIMELINE_ITEMS = 100;
export const LIMITS = {
  name: 120,
  description: 5000,
  eventType: 60,
  venue: 200,
  address: 400,
  locality: 120,
  guestName: 120,
  bio: 600,
  email: 254,
  timelineTitle: 140,
  timelineDescription: 1000,
  timelineLocation: 200,
} as const;

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

function tooLong(errors: FieldErrors, key: string, value: string, max: number, label: string) {
  if (value.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

export function validateCapacity(value: unknown, systemLimit = DEFAULT_MAX_CAPACITY_LIMIT): string | null {
  const n = num(value);
  if (value === undefined || value === null || value === "") return "Maximum capacity is required.";
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Maximum capacity must be a whole number.";
  if (n <= 0) return "Maximum capacity must be at least 1.";
  if (n > systemLimit) return `Maximum capacity cannot exceed ${systemLimit.toLocaleString("en-US")}.`;
  return null;
}

// ---------------------------------------------------------------------------
// Event details + venue + capacity
// ---------------------------------------------------------------------------

export type EventDetailsValue = {
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
  showGuestBios: boolean;
  showSpeakers: boolean;
};

export function validateEventDetails(
  input: EventDetailsInput,
  opts: { maxCapacityLimit?: number; now?: Date; requireFuture?: boolean } = {},
): Validated<EventDetailsValue> {
  const errors: FieldErrors = {};
  const name = str(input.name);
  const description = str(input.description);
  const eventType = str(input.eventType) || "Other";
  const date = str(input.date);
  const startTime = str(input.startTime);
  const timezone = str(input.timezone) || "UTC";
  const venueName = str(input.venueName);
  const address = str(input.address);
  const city = str(input.city);
  const state = str(input.state);
  const country = str(input.country);

  if (!name) errors.name = "Event name is required.";
  tooLong(errors, "name", name, LIMITS.name, "Event name");
  if (!description) errors.description = "Description is required.";
  tooLong(errors, "description", description, LIMITS.description, "Description");
  tooLong(errors, "eventType", eventType, LIMITS.eventType, "Event type");

  if (!date) errors.date = "Event date is required.";
  else if (!parseDateParts(date)) errors.date = "Enter a valid date.";
  if (!startTime) errors.startTime = "Start time is required.";
  else if (!parseTimeParts(startTime)) errors.startTime = "Enter a valid start time (HH:MM).";
  if (!isValidTimezone(timezone)) errors.timezone = "Unknown time zone.";

  const duration = num(input.durationMinutes);
  if (input.durationMinutes === undefined || input.durationMinutes === null || input.durationMinutes === "") {
    errors.durationMinutes = "Duration is required.";
  } else if (!Number.isInteger(duration) || duration <= 0) {
    errors.durationMinutes = "Duration must be a positive number of minutes.";
  } else if (duration > MAX_DURATION_MINUTES) {
    errors.durationMinutes = "Duration cannot exceed 14 days.";
  }

  if (!venueName) errors.venueName = "Venue name is required.";
  tooLong(errors, "venueName", venueName, LIMITS.venue, "Venue name");
  if (!address) errors.address = "Address is required.";
  tooLong(errors, "address", address, LIMITS.address, "Address");
  if (!city) errors.city = "City is required.";
  if (!country) errors.country = "Country is required.";
  for (const [key, value] of [["city", city], ["state", state], ["country", country]] as const) {
    tooLong(errors, key, value, LIMITS.locality, key[0].toUpperCase() + key.slice(1));
  }

  const latitude = num(input.latitude);
  const longitude = num(input.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    errors.location = "Pin the venue location on the map.";
  }

  const capacityError = validateCapacity(input.maxCapacity, opts.maxCapacityLimit);
  if (capacityError) errors.maxCapacity = capacityError;

  let startDatetime = "";
  if (!errors.date && !errors.startTime && !errors.timezone) {
    startDatetime = zonedToUtcIso(date, startTime, timezone) ?? "";
    if (!startDatetime) errors.date = "Enter a valid date.";
    else if (opts.requireFuture && Date.parse(startDatetime) < (opts.now ?? new Date()).getTime()) {
      errors.date = "The event must start in the future.";
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      description,
      eventType,
      startDatetime,
      timezone,
      durationMinutes: duration,
      venueName,
      address,
      city,
      state,
      country,
      latitude,
      longitude,
      maxCapacity: num(input.maxCapacity),
      showGuestBios: input.showGuestBios === true,
      showSpeakers: input.showSpeakers !== false,
    },
  };
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type TimelineValue = {
  id?: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  location: string;
  sortOrder: number;
};

function isoInstant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return Number.NaN;
  return Date.parse(value);
}

export function validateTimeline(
  items: TimelineInput[] | unknown,
  window: { startDatetime: string; durationMinutes: number },
): { ok: true; value: TimelineValue[] } | { ok: false; errors: FieldErrors[]; message: string } {
  if (!Array.isArray(items)) return { ok: false, errors: [], message: "Timeline must be a list." };
  if (items.length > MAX_TIMELINE_ITEMS) {
    return { ok: false, errors: [], message: `A timeline can have at most ${MAX_TIMELINE_ITEMS} entries.` };
  }
  const eventStart = Date.parse(window.startDatetime);
  const eventEnd = eventStart + window.durationMinutes * 60_000;
  const errors: FieldErrors[] = [];
  const value: TimelineValue[] = [];
  let hasError = false;

  items.forEach((raw, index) => {
    const item = (raw ?? {}) as TimelineInput;
    const e: FieldErrors = {};
    const title = str(item.title);
    const description = str(item.description);
    const location = str(item.location);
    const start = isoInstant(item.startTime);
    const end = isoInstant(item.endTime);
    if (!title) e.title = "Title is required.";
    tooLong(e, "title", title, LIMITS.timelineTitle, "Title");
    tooLong(e, "description", description, LIMITS.timelineDescription, "Description");
    tooLong(e, "location", location, LIMITS.timelineLocation, "Location");
    if (!Number.isFinite(start)) e.startTime = "Start time is required.";
    if (!Number.isFinite(end)) e.endTime = "End time is required.";
    if (Number.isFinite(start) && Number.isFinite(end)) {
      if (end <= start) e.endTime = "End time must be after the start time.";
      if (start < eventStart || start > eventEnd) e.startTime = "Start time must be within the event duration.";
      if (end > eventEnd) e.endTime = "End time must be within the event duration.";
    }
    if (Object.keys(e).length) hasError = true;
    errors.push(e);
    value.push({
      id: typeof item.id === "string" && item.id ? item.id : undefined,
      startTime: Number.isFinite(start) ? new Date(start).toISOString() : "",
      endTime: Number.isFinite(end) ? new Date(end).toISOString() : "",
      title,
      description,
      location,
      sortOrder: index,
    });
  });

  if (hasError) return { ok: false, errors, message: "Fix the highlighted timeline entries." };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Keep a leading + and digits only. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function parseRole(value: unknown): GuestRole | null {
  const raw = str(value);
  if (!raw) return "GUEST";
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if ((GUEST_ROLES as readonly string[]).includes(upper)) return upper as GuestRole;
  const lower = raw.toLowerCase();
  for (const role of GUEST_ROLES) {
    if (GUEST_ROLE_LABELS[role].toLowerCase() === lower) return role;
  }
  if (["worker", "staff", "worker / staff", "worker-staff"].includes(lower)) return "STAFF";
  return null;
}

export type GuestValue = {
  name: string;
  email: string;
  phone: string;
  bio: string;
  role: GuestRole;
};

export function validateGuest(input: GuestInput): Validated<GuestValue> {
  const errors: FieldErrors = {};
  const name = str(input.name);
  const email = normalizeEmail(str(input.email));
  const phone = normalizePhone(str(input.phone));
  const bio = str(input.bio);
  const role = parseRole(input.role);

  if (!name) errors.name = "Guest name is required.";
  tooLong(errors, "name", name, LIMITS.guestName, "Name");
  if (email && (!EMAIL_RE.test(email) || email.length > LIMITS.email)) errors.email = "Enter a valid email address.";
  const digits = phone.replace(/\D/g, "");
  if (str(input.phone) && (digits.length < 7 || digits.length > 15)) {
    errors.phone = "Enter a valid phone number (7–15 digits).";
  }
  tooLong(errors, "bio", bio, LIMITS.bio, "Bio");
  if (!role) errors.role = "Choose a valid role.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email, phone, bio, role: role as GuestRole } };
}

/** Stable identity keys used for duplicate detection. */
export function guestIdentityKeys(g: { name: string; email: string; phone: string }): string[] {
  const keys: string[] = [];
  if (g.email) keys.push(`email:${normalizeEmail(g.email)}`);
  if (g.phone) keys.push(`phone:${normalizePhone(g.phone).replace(/^\+/, "")}`);
  if (!keys.length) keys.push(`name:${g.name.trim().toLowerCase().replace(/\s+/g, " ")}`);
  return keys;
}

export function findDuplicateKey(
  candidate: { name: string; email: string; phone: string },
  existing: Set<string>,
): string | null {
  for (const key of guestIdentityKeys(candidate)) {
    if (existing.has(key)) return key;
  }
  return null;
}
