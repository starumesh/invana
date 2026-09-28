import { isWellFormedToken } from "./ids.ts";

/**
 * QR payload: a secure reference only — `{ v, eventId, passToken }`.
 * No names, phones, emails, or addresses. The server re-validates everything.
 */
export type QrPayload = { v: 1; eventId: string; passToken: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeQrPayload(eventId: string, passToken: string): string {
  return JSON.stringify({ v: 1, eventId, passToken } satisfies QrPayload);
}

/**
 * Parse scanner input. Accepts the JSON payload or a guest pass URL (`…/pass/<token>`),
 * so a phone camera scan of the link also works. Returns null for anything else.
 */
export function decodeQrPayload(raw: unknown): { eventId: string | null; passToken: string } | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 2048) return null;

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Partial<QrPayload>;
      if (parsed?.v !== 1) return null;
      if (typeof parsed.eventId !== "string" || !UUID_RE.test(parsed.eventId)) return null;
      if (!isWellFormedToken(parsed.passToken)) return null;
      return { eventId: parsed.eventId.toLowerCase(), passToken: parsed.passToken };
    } catch {
      return null;
    }
  }

  const match = /\/pass\/([A-Za-z0-9_-]{43})(?:[/?#].*)?$/.exec(text);
  if (match) return { eventId: null, passToken: match[1] };
  return null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
