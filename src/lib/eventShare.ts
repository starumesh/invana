import { formatDuration, formatEventDate, formatEventTime } from "@event-core";
import { publicOrigin } from "@/lib/url";

type ShareableEvent = {
  name: string;
  startDatetime: string;
  timezone: string;
  durationMinutes: number;
  venueName: string;
  city: string;
};

export function publicEventUrl(slug: string): string {
  return `${publicOrigin()}/events/${encodeURIComponent(slug)}`;
}

export function guestPassUrl(token: string): string {
  return `${publicOrigin()}/pass/${token}`;
}

export function eventWhen(e: Pick<ShareableEvent, "startDatetime" | "timezone">): { date: string; time: string } {
  return { date: formatEventDate(e.startDatetime, e.timezone), time: formatEventTime(e.startDatetime, e.timezone) };
}

export function venueLine(e: Pick<ShareableEvent, "venueName" | "city">): string {
  return [e.venueName, e.city].filter(Boolean).join(", ");
}

/** WhatsApp message with name, date, time, venue, and URL. */
export function eventWhatsAppText(e: ShareableEvent, url: string): string {
  const { date, time } = eventWhen(e);
  return [
    `You're invited: *${e.name}*`,
    `📅 ${date}`,
    `🕒 ${time} (${formatDuration(e.durationMinutes)})`,
    `📍 ${venueLine(e)}`,
    "",
    url,
  ].join("\n");
}

export function passWhatsAppText(e: ShareableEvent, guestName: string, url: string): string {
  const { date, time } = eventWhen(e);
  return [
    `Hi ${guestName}, here is your personal entry pass for *${e.name}*.`,
    `📅 ${date} · 🕒 ${time}`,
    `📍 ${venueLine(e)}`,
    "",
    "Show the QR code at the entrance:",
    url,
    "",
    "This link is just for you — please don't forward it.",
  ].join("\n");
}

export function whatsAppUrl(text: string, phone?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Native share sheet when available; returns false so callers can fall back. */
export async function nativeShare(data: { title: string; text?: string; url: string }): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    await navigator.share(data);
    return true;
  } catch (err) {
    return err instanceof DOMException && err.name === "AbortError";
  }
}
