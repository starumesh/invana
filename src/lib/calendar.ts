import { downloadFile } from "@/lib/download";

/** Calendar links (Google, Outlook) and an .ics file (Apple / others) with reminders. */
export type CalendarEvent = {
  title: string;
  description: string;
  location: string;
  startIso: string;
  durationMinutes: number;
  url?: string;
  uid?: string;
};

/** Reminder-ready: 7 days, 1 day, and 1 hour before. */
export const REMINDER_OFFSETS = [
  { label: "7 days before", trigger: "-P7D" },
  { label: "1 day before", trigger: "-P1D" },
  { label: "1 hour before", trigger: "-PT1H" },
] as const;

function endIso(e: CalendarEvent): string {
  return new Date(Date.parse(e.startIso) + e.durationMinutes * 60_000).toISOString();
}

function compact(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function details(e: CalendarEvent): string {
  return e.url ? `${e.description}\n\n${e.url}` : e.description;
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${compact(e.startIso)}/${compact(endIso(e))}`,
    details: details(e),
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.startIso,
    enddt: endIso(e),
    body: details(e),
    location: e.location,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** RFC 5545 line folding at 75 octets (approximated by characters). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(e: CalendarEvent, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Invana//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid ?? `${compact(e.startIso)}-${Math.random().toString(36).slice(2)}`}@invana`,
    `DTSTAMP:${compact(now.toISOString())}`,
    `DTSTART:${compact(e.startIso)}`,
    `DTEND:${compact(endIso(e))}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `DESCRIPTION:${icsEscape(details(e))}`,
    `LOCATION:${icsEscape(e.location)}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    ...REMINDER_OFFSETS.flatMap((r) => [
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(`${e.title} — ${r.label}`)}`,
      `TRIGGER:${r.trigger}`,
      "END:VALARM",
    ]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(e: CalendarEvent, filename = "event.ics") {
  downloadFile(new Blob([buildIcs(e)], { type: "text/calendar;charset=utf-8" }), filename);
}
