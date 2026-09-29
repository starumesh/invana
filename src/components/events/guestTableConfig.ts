import { formatEventTime, GUEST_ROLE_LABELS, toCsv, type GuestFilter, type GuestRow } from "@event-core";
import { downloadFile } from "@/lib/download";

const STAGE_TEXT: Record<GuestRow["stage"], string> = {
  NO_PASS: "Guest added",
  PASS_GENERATED: "Pass generated",
  PASS_SHARED: "Pass shared",
  CHECKED_IN: "Checked in",
  CANCELLED: "Cancelled",
};

export type FilterTab = { id: GuestFilter; label: string };

export const GUEST_TABS: FilterTab[] = [
  { id: "ALL", label: "All" },
  { id: "NO_PASS", label: "Guest Added" },
  { id: "HAS_PASS", label: "Pass Generated" },
  { id: "PASS_SHARED", label: "Pass Shared" },
  { id: "CHECKED_IN", label: "Checked In" },
];

export const PASS_TABS: FilterTab[] = [
  { id: "ALL", label: "All" },
  { id: "HAS_PASS", label: "Pass Generated" },
  { id: "NO_PASS", label: "Not Generated" },
  { id: "CHECKED_IN", label: "Checked In" },
  { id: "NOT_CHECKED_IN", label: "Not Checked In" },
];

export const PAGE_SIZES = [25, 50, 100];

export function fmtDate(iso: string | null | undefined, tz: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(iso));
}

export function exportGuestsCsv(rows: GuestRow[], filename: string, tz: string) {
  const csv = toCsv(
    ["Name", "Email", "Phone", "Bio", "Role", "Guest status", "Pass ID", "Pass status", "Pass generated", "Pass shared", "Checked in", "Check-in time"],
    rows.map((r) => [
      r.name,
      r.email,
      r.phone,
      r.bio,
      GUEST_ROLE_LABELS[r.role],
      STAGE_TEXT[r.stage],
      r.pass?.publicId ?? "",
      r.pass?.status ?? "NOT GENERATED",
      r.pass?.issuedAt ?? "",
      r.pass?.sharedAt ?? "",
      r.stage === "CHECKED_IN" ? "Yes" : "No",
      r.pass?.checkedInAt ? `${r.pass.checkedInAt} (${formatEventTime(r.pass.checkedInAt, tz)})` : "",
    ]),
  );
  downloadFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

