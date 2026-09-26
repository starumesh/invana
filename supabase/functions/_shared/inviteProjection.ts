/**
 * Public-safe invite projection — no host PII beyond invitation fields, no guest list.
 * Mirrors the product Invite Read API contract (Phase 1).
 */
export type PublicInvite = {
  id: string;
  slug: string;
  title: string;
  status: "published";
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type EventRow = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function toPublicInvite(row: EventRow): PublicInvite {
  const config = row.config && typeof row.config === "object" ? { ...row.config } : {};
  // Never expose host user id on the public surface.
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: "published",
    config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type { EventRow };
