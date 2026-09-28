/** Crypto-secure identifiers. Uses Web Crypto (browser, Deno, Node ≥ 19). */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const HEX = "0123456789ABCDEF";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Unbiased random characters from `alphabet` (rejection sampling). */
function randomChars(alphabet: string, length: number): string {
  const max = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= max) continue;
      out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export function uuid(): string {
  return crypto.randomUUID();
}

/** 256-bit URL-safe token used in QR codes and guest pass links. */
export function secureToken(): string {
  const bytes = randomBytes(32);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** Human-facing event reference, e.g. `INV-EVT-2026-7KQ2MX`. Random, not sequential. */
export function eventPublicId(year: number): string {
  return `INV-EVT-${year}-${randomChars(CROCKFORD, 6)}`;
}

export const EVENT_PUBLIC_ID_PATTERN = /^INV-EVT-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/;

/** Human-facing pass reference, e.g. `INV-PASS-8F72A91C`. Never the DB primary key. */
export function passPublicId(): string {
  return `INV-PASS-${randomChars(HEX, 8)}`;
}

export const PASS_PUBLIC_ID_PATTERN = /^INV-PASS-[0-9A-F]{8}$/;

export function normalizePassPublicId(value: string): string | null {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  if (PASS_PUBLIC_ID_PATTERN.test(compact)) return compact;
  if (/^[0-9A-F]{8}$/.test(compact)) return `INV-PASS-${compact}`;
  return null;
}

export const RESERVED_SLUGS = new Set(["create", "new", "edit", "manage", "admin", "api", "check-in"]);

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Human-readable public slug. Not a security identifier — the suffix only avoids collisions. */
export function eventSlug(name: string, startDatetime: string): string {
  const base = slugify(name) || "event";
  const year = startDatetime.slice(0, 4);
  const suffix = randomChars("abcdefghjkmnpqrstuvwxyz23456789", 4);
  return `${base}-${year}-${suffix}`;
}
