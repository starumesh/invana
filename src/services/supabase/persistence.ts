import { normalizeSlug } from "@/lib/slug";
import { requireSupabase } from "@/lib/supabase/client";
import { normalizeCardType } from "@/config/card-types";
import type { PersistenceProvider } from "@/services/types";
import type { RenderInput, Rsvp, StoredEvent } from "@/types";

type EventRow = {
  id: string;
  user_id: string;
  kind: "invitation" | "card";
  event_type: string | null;
  card_type: string | null;
  template_id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  config: RenderInput;
  created_at: string;
  updated_at: string;
};

type RsvpRow = {
  id: string;
  event_id: string;
  guest_name: string;
  response: "yes" | "no" | "maybe";
  party_size: number;
  phone: string | null;
  email: string | null;
  dietary: string | null;
  message: string | null;
  created_at: string;
};

function slugKey(slug: string): string {
  try {
    return normalizeSlug(decodeURIComponent(slug));
  } catch {
    return normalizeSlug(slug);
  }
}

function toStored(row: EventRow): StoredEvent {
  const config: RenderInput = {
    ...row.config,
    schemaVersion: 1,
    kind: row.config?.kind ?? row.kind,
    eventType: row.config?.eventType ?? (row.event_type as RenderInput["eventType"]) ?? undefined,
    cardType:
      normalizeCardType(row.config?.cardType ?? row.card_type) ??
      (row.config?.cardType as RenderInput["cardType"]) ??
      undefined,
    templateId: row.config?.templateId ?? row.template_id,
    fields: row.config?.fields ?? {},
  };
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(event: StoredEvent): Omit<EventRow, "created_at" | "updated_at"> & {
  created_at: string;
  updated_at: string;
} {
  return {
    id: event.id,
    user_id: event.userId,
    kind: event.config.kind,
    event_type: event.config.eventType ?? null,
    card_type: event.config.cardType ?? null,
    template_id: event.config.templateId,
    title: event.title,
    slug: slugKey(event.slug) || event.slug,
    status: event.status,
    config: event.config,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  };
}

function toRsvp(row: RsvpRow): Rsvp {
  return {
    id: row.id,
    eventId: row.event_id,
    guestName: row.guest_name,
    response: row.response,
    partySize: row.party_size,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    dietary: row.dietary ?? undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
  };
}

async function requireAuthedUserId(): Promise<string> {
  const sb = requireSupabase();
  // Prefer local session (no Auth network round-trip). RLS still enforces the JWT.
  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData.session?.user?.id) return sessionData.session.user.id;
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sign in required to sync this event to the cloud.");
  }
  return data.user.id;
}

export const supabasePersistence: PersistenceProvider = {
  async listEvents(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as EventRow[]).map(toStored);
  },

  async getEvent(id) {
    const sb = requireSupabase();
    const { data, error } = await sb.from("events").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toStored(data as EventRow) : null;
  },

  async getBySlug(slug) {
    const sb = requireSupabase();
    const key = slugKey(slug);
    if (!key) return null;
    // eq first (slugs are normalized on write); anon can read via events_select_published RLS.
    const { data: exactRow, error: exactErr } = await sb
      .from("events")
      .select("*")
      .eq("slug", key)
      .maybeSingle();
    if (exactErr) throw new Error(exactErr.message);
    if (exactRow) {
      const stored = toStored(exactRow as EventRow);
      if (stored.status === "published") return stored;
    }
    const { data, error } = await sb.from("events").select("*").ilike("slug", key);
    if (error) throw new Error(error.message);
    const rows = (data as EventRow[] | null) ?? [];
    const exact = rows.filter((row) => slugKey(row.slug) === key);
    const published = exact.find((row) => row.status === "published");
    if (published) return toStored(published);
    if (exactRow) return toStored(exactRow as EventRow);
    return exact[0] ? toStored(exact[0]) : null;
  },

  async saveEvent(event) {
    const sb = requireSupabase();
    const userId = await requireAuthedUserId();
    if (event.userId === "unauthenticated" || event.userId !== userId) {
      event = { ...event, userId };
    }
    const row = toRow(event);
    const { data, error } = await sb.from("events").upsert(row).select("*").single();
    if (error) throw new Error(error.message);
    return toStored(data as EventRow);
  },

  async deleteEvent(id) {
    const sb = requireSupabase();
    await requireAuthedUserId();
    const { error } = await sb.from("events").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listRsvps(eventId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("rsvps")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as RsvpRow[]).map(toRsvp);
  },

  async listRsvpsForEventIds(eventIds) {
    if (!eventIds.length) return [];
    const sb = requireSupabase();
    const unique = [...new Set(eventIds)];
    // Chunk to stay under typical PostgREST URL / `.in` limits.
    const chunkSize = 80;
    const rows: RsvpRow[] = [];
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const { data, error } = await sb
        .from("rsvps")
        .select("*")
        .in("event_id", chunk)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      rows.push(...((data as RsvpRow[]) ?? []));
    }
    return rows.map(toRsvp);
  },

  async addRsvp(rsvp) {
    const sb = requireSupabase();
    const row = {
      id: rsvp.id,
      event_id: rsvp.eventId,
      guest_name: rsvp.guestName,
      response: rsvp.response,
      party_size: rsvp.partySize,
      phone: rsvp.phone ?? null,
      email: rsvp.email ?? null,
      dietary: rsvp.dietary ?? null,
      message: rsvp.message ?? null,
      created_at: rsvp.createdAt,
    };
    const { data, error } = await sb.from("rsvps").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    return toRsvp(data as RsvpRow);
  },

  async takenSlugs(excludeEventId) {
    const sb = requireSupabase();
    let query = sb.from("events").select("id, slug");
    if (excludeEventId) query = query.neq("id", excludeEventId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data as { id: string; slug: string }[]) ?? [])
      .map((row) => slugKey(row.slug))
      .filter(Boolean);
  },
};
