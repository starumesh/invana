import type { GuestFilter, GuestQuery, GuestRow, GuestStage } from "./types.ts";

export function matchesFilter(stage: GuestStage, filter: GuestFilter): boolean {
  switch (filter) {
    case "NO_PASS":
      return stage === "NO_PASS";
    case "HAS_PASS":
      return stage === "PASS_GENERATED" || stage === "PASS_SHARED" || stage === "CHECKED_IN";
    case "PASS_SHARED":
      return stage === "PASS_SHARED";
    case "CHECKED_IN":
      return stage === "CHECKED_IN";
    case "NOT_CHECKED_IN":
      return stage === "NO_PASS" || stage === "PASS_GENERATED" || stage === "PASS_SHARED";
    case "CANCELLED":
      return stage === "CANCELLED";
    default:
      return true;
  }
}

/** Reference implementation of the guest query (the Postgres view mirrors it). */
export function applyGuestQuery(all: GuestRow[], query: Required<Omit<GuestQuery, "role">> & { role: GuestQuery["role"] }) {
  const q = query.q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  const filtered = all.filter((r) => {
    if (!matchesFilter(r.stage, query.filter)) return false;
    if (query.role && query.role !== "ALL" && r.role !== query.role) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.includes(q) ||
      (digits.length >= 3 && r.phone.includes(digits)) ||
      (r.pass?.publicId.toLowerCase().includes(q) ?? false)
    );
  });
  const key = (r: GuestRow): string => {
    switch (query.sort) {
      case "name":
        return r.name.toLowerCase();
      case "generated":
        return r.pass?.issuedAt ?? "";
      case "checked_in":
        return r.pass?.checkedInAt ?? "";
      case "stage":
        return r.stage;
      default:
        return r.createdAt;
    }
  };
  const dir = query.dir === "desc" ? -1 : 1;
  filtered.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (!ka && kb) return 1;
    if (ka && !kb) return -1;
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir || (a.id < b.id ? -1 : 1);
  });
  return { rows: filtered.slice(query.offset, query.offset + query.limit), total: filtered.length };
}
