/** Timezone helpers built on Intl only (no date libraries). */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseDateParts(date: string): { y: number; m: number; d: number } | null {
  const match = DATE_RE.exec(date);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function parseTimeParts(time: string): { h: number; min: number } | null {
  const match = TIME_RE.exec(time);
  if (!match) return null;
  return { h: Number(match[1]), min: Number(match[2]) };
}

function wallClockParts(instantMs: number, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(instantMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    y: parts.year,
    m: parts.month,
    d: parts.day,
    h: parts.hour === 24 ? 0 : parts.hour,
    min: parts.minute,
    s: parts.second,
  };
}

function offsetMs(instantMs: number, tz: string): number {
  const w = wallClockParts(instantMs, tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** Convert a wall-clock date + time in `tz` to a UTC ISO string. */
export function zonedToUtcIso(date: string, time: string, tz: string): string | null {
  const dp = parseDateParts(date);
  const tp = parseTimeParts(time);
  if (!dp || !tp || !isValidTimezone(tz)) return null;
  const guess = Date.UTC(dp.y, dp.m - 1, dp.d, tp.h, tp.min);
  let instant = guess - offsetMs(guess, tz);
  instant = guess - offsetMs(instant, tz);
  return new Date(instant).toISOString();
}

/** Wall-clock `{ date: YYYY-MM-DD, time: HH:mm }` of an instant in `tz`. */
export function utcToZoned(iso: string, tz: string): { date: string; time: string } {
  const w = wallClockParts(Date.parse(iso), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${w.y}-${pad(w.m)}-${pad(w.d)}`, time: `${pad(w.h)}:${pad(w.min)}` };
}

/**
 * Resolve a timeline HH:mm to an instant within the event window. Times earlier
 * than the event start roll over to the next day (e.g. a reception ending 01:00).
 */
export function timelineTimeToIso(eventStartIso: string, tz: string, hhmm: string): string | null {
  const { date, time: startTime } = utcToZoned(eventStartIso, tz);
  const iso = zonedToUtcIso(date, hhmm, tz);
  if (!iso) return null;
  if (hhmm < startTime) {
    return new Date(Date.parse(iso) + 24 * 60 * 60 * 1000).toISOString();
  }
  return iso;
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

export function formatEventDate(iso: string, tz: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatEventTime(iso: string, tz: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${h} hr${h === 1 ? "" : "s"} ${m} min`;
}
