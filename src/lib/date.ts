import type { DateValue, TimeValue } from "@/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function isDateValue(value: unknown): value is DateValue & { day: number; month: number } {
  if (!value || typeof value !== "object") return false;
  const date = value as DateValue;
  return (
    Number.isInteger(date.year) &&
    Number.isInteger(date.day) &&
    Number.isInteger(date.month) &&
    (date.day as number) >= 1 &&
    (date.day as number) <= 31 &&
    (date.month as number) >= 1 &&
    (date.month as number) <= 12
  );
}

export function isTimeValue(value: unknown): value is TimeValue {
  if (!value || typeof value !== "object") return false;
  const time = value as TimeValue;
  return (
    Number.isInteger(time.hour) &&
    time.hour >= 0 &&
    time.hour <= 23 &&
    Number.isInteger(time.minute) &&
    time.minute >= 0 &&
    time.minute <= 59
  );
}

export function formatDate(
  date: DateValue & { day: number; month: number },
  style: "long" | "weekday" | "numeric" = "long",
): string {
  const safeMonth = Math.min(12, Math.max(1, date.month));
  const jsDate = new Date(date.year, safeMonth - 1, date.day);
  if (Number.isNaN(jsDate.getTime())) return "";
  if (style === "numeric") {
    return `${String(date.day).padStart(2, "0")}.${String(safeMonth).padStart(2, "0")}.${date.year}`;
  }
  const long = `${date.day} ${MONTHS[safeMonth - 1]} ${date.year}`;
  if (style === "weekday") return `${WEEKDAYS[jsDate.getDay()]}, ${long}`;
  return long;
}

export function formatTime(time: TimeValue): string {
  const minute = String(time.minute).padStart(2, "0");
  if (time.format === "24h") {
    return `${String(time.hour).padStart(2, "0")}:${minute}`;
  }
  const period = time.hour >= 12 ? "PM" : "AM";
  const hour12 = time.hour % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

/** Start–end range when both times are set; otherwise just the start. */
export function formatTimeRange(start?: TimeValue | null, end?: TimeValue | null): string {
  const from = start && isTimeValue(start) ? formatTime(start) : "";
  const to = end && isTimeValue(end) ? formatTime(end) : "";
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export function defaultDate(daysAhead = 90): DateValue {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

export function defaultTime(): TimeValue {
  return { hour: 18, minute: 30, format: "12h" };
}
