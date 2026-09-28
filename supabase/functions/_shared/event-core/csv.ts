import type { FieldErrors } from "./errors.ts";
import { findDuplicateKey, guestIdentityKeys, validateGuest, type GuestValue } from "./validation.ts";

export const GUEST_CSV_HEADERS = ["Name", "Email", "Phone", "Bio", "Role"] as const;
export const GUEST_CSV_TEMPLATE = `${GUEST_CSV_HEADERS.join(",")}\nAsha Rao,asha@example.com,+919800000001,Bride's cousin,Guest\n`;
export const MAX_CSV_ROWS = 5000;

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF/LF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export type CsvRowStatus = "VALID" | "INVALID" | "DUPLICATE" | "OVER_CAPACITY";

export type CsvPreviewRow = {
  line: number;
  raw: Record<string, string>;
  status: CsvRowStatus;
  value?: GuestValue;
  errors: FieldErrors;
  message?: string;
};

export type CsvPreview = {
  rows: CsvPreviewRow[];
  valid: GuestValue[];
  counts: Record<CsvRowStatus, number>;
  headerError?: string;
};

/**
 * Validate a guest CSV against existing guests and remaining capacity.
 * Pure — used for the client preview and again server-side on save.
 */
export function previewGuestCsv(
  text: string,
  opts: {
    existing: { name: string; email: string; phone: string }[];
    remainingCapacity: number;
  },
): CsvPreview {
  const counts: Record<CsvRowStatus, number> = { VALID: 0, INVALID: 0, DUPLICATE: 0, OVER_CAPACITY: 0 };
  const table = parseCsv(text);
  if (!table.length) return { rows: [], valid: [], counts, headerError: "The file is empty." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const index = Object.fromEntries(GUEST_CSV_HEADERS.map((h) => [h, header.indexOf(h.toLowerCase())]));
  if (index.Name < 0) {
    return {
      rows: [],
      valid: [],
      counts,
      headerError: `Missing "Name" column. Expected header: ${GUEST_CSV_HEADERS.join(",")}`,
    };
  }
  if (table.length - 1 > MAX_CSV_ROWS) {
    return { rows: [], valid: [], counts, headerError: `A CSV can contain at most ${MAX_CSV_ROWS} guests.` };
  }

  const seen = new Set<string>();
  for (const g of opts.existing) for (const key of guestIdentityKeys(g)) seen.add(key);

  let remaining = Math.max(0, opts.remainingCapacity);
  const rows: CsvPreviewRow[] = [];
  const valid: GuestValue[] = [];

  table.slice(1).forEach((cells, i) => {
    const raw: Record<string, string> = {};
    for (const h of GUEST_CSV_HEADERS) raw[h] = index[h] >= 0 ? (cells[index[h]] ?? "").trim() : "";
    const line = i + 2;
    const result = validateGuest({ name: raw.Name, email: raw.Email, phone: raw.Phone, bio: raw.Bio, role: raw.Role });
    if (!result.ok) {
      counts.INVALID += 1;
      rows.push({ line, raw, status: "INVALID", errors: result.errors, message: Object.values(result.errors)[0] });
      return;
    }
    if (findDuplicateKey(result.value, seen)) {
      counts.DUPLICATE += 1;
      rows.push({ line, raw, status: "DUPLICATE", errors: {}, value: result.value, message: "This guest is already registered for this event." });
      return;
    }
    if (remaining <= 0) {
      counts.OVER_CAPACITY += 1;
      rows.push({ line, raw, status: "OVER_CAPACITY", errors: {}, value: result.value, message: "Maximum event capacity has been reached." });
      return;
    }
    for (const key of guestIdentityKeys(result.value)) seen.add(key);
    remaining -= 1;
    counts.VALID += 1;
    valid.push(result.value);
    rows.push({ line, raw, status: "VALID", errors: {}, value: result.value });
  });

  return { rows, valid, counts };
}

function csvCell(value: string): string {
  const risky = /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !/^[+-][\d\s()-]+$/.test(value));
  const guarded = risky ? `'${value}` : value;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Serialize rows to CSV with formula-injection guarding. */
export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
