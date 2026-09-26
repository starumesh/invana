// Invana RSVP service — public insert + host list.
// Deploy: `supabase functions deploy rsvp`
// Product routes:
//   POST /v1/invites/{slug}/rsvps  → body { guestName, response, … }
//   GET  /v1/events/{id}/rsvps     → JWT host list (query ?eventId=)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions } from "../_shared/cors.ts";
import { clientIp, json, readJson, requestId } from "../_shared/http.ts";
import { assertRateLimit } from "../_shared/rateLimit.ts";
import { slugKey } from "../_shared/slug.ts";
import { anonClient, requireUserId, serviceClient } from "../_shared/supabase.ts";

type RsvpBody = {
  id?: string;
  guestName?: string;
  response?: "yes" | "no" | "maybe";
  partySize?: number;
  phone?: string;
  email?: string;
  dietary?: string;
  message?: string;
  createdAt?: string;
  /** Optional when resolving by slug in the URL / query. */
  eventId?: string;
  slug?: string;
};

serve(async (req) => {
  const rid = requestId(req);
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    if (req.method === "GET") {
      return await handleHostList(req, rid);
    }
    if (req.method === "POST") {
      return await handlePublicInsert(req, rid);
    }
    return json({ error: "Method not allowed." }, 405, { requestId: rid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHORIZED") {
      return json({ error: "Unauthorized." }, 401, { requestId: rid });
    }
    console.error(JSON.stringify({ requestId: rid, msg: "rsvp_unhandled", error: message }));
    return json({ error: message }, 500, { requestId: rid });
  }
});

async function handlePublicInsert(req: Request, rid: string): Promise<Response> {
  const url = new URL(req.url);
  const body = await readJson<RsvpBody>(req);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Support …/rsvp/{slug} or ?slug=
  const pathSlug =
    pathParts.length >= 2 && pathParts[pathParts.length - 2] === "rsvp"
      ? pathParts[pathParts.length - 1]
      : "";
  const rawSlug = body.slug || url.searchParams.get("slug") || pathSlug;
  const key = slugKey(rawSlug);

  const guestName = (body.guestName ?? "").trim();
  const response = body.response;
  const partySize = Number(body.partySize ?? 1);

  if (!guestName || !response || !["yes", "no", "maybe"].includes(response)) {
    return json({ error: "guestName and response (yes|no|maybe) are required." }, 400, {
      requestId: rid,
    });
  }
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 50) {
    return json({ error: "partySize must be between 1 and 50." }, 400, { requestId: rid });
  }

  const admin = serviceClient();
  const ip = clientIp(req);
  const rl = await assertRateLimit(admin, {
    key: `rsvp:${ip}`,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return json({ error: "Too many RSVPs from this network. Try again shortly." }, 429, {
      requestId: rid,
      headers: { "Retry-After": "60" },
    });
  }

  // Resolve published event (anon RLS: published only).
  const sb = anonClient();
  let eventId = (body.eventId ?? "").trim();
  if (key) {
    const { data: eventRow, error: eventErr } = await sb
      .from("events")
      .select("id, status, slug")
      .eq("slug", key)
      .maybeSingle();
    if (eventErr) return json({ error: eventErr.message }, 500, { requestId: rid });
    if (!eventRow || eventRow.status !== "published") {
      return json({ error: "Invitation is not published." }, 404, { requestId: rid });
    }
    eventId = eventRow.id as string;
  } else if (eventId) {
    const { data: eventRow, error: eventErr } = await sb
      .from("events")
      .select("id, status")
      .eq("id", eventId)
      .maybeSingle();
    if (eventErr) return json({ error: eventErr.message }, 500, { requestId: rid });
    if (!eventRow || eventRow.status !== "published") {
      return json({ error: "Invitation is not published." }, 404, { requestId: rid });
    }
  } else {
    return json({ error: "slug or eventId is required." }, 400, { requestId: rid });
  }

  const id = (body.id ?? "").trim() || crypto.randomUUID();
  const createdAt = body.createdAt || new Date().toISOString();
  const row = {
    id,
    event_id: eventId,
    guest_name: guestName,
    response,
    party_size: partySize,
    phone: body.phone?.trim() || null,
    email: body.email?.trim() || null,
    dietary: body.dietary?.trim() || null,
    message: body.message?.trim() || null,
    created_at: createdAt,
  };

  // Insert via anon so RLS "published only" is enforced; no .select() (guests cannot SELECT).
  const { error: insertErr } = await sb.from("rsvps").insert(row);
  if (insertErr) {
    console.error(JSON.stringify({ requestId: rid, msg: "rsvp_insert_failed", error: insertErr.message }));
    return json({ error: insertErr.message }, 400, { requestId: rid });
  }

  // Optional outbox for future email worker (dashboard-only notifications in V1).
  try {
    await admin.from("outbox_events").insert({
      id: crypto.randomUUID(),
      topic: "rsvp.created",
      payload: { rsvpId: id, eventId, guestName, response, partySize },
      created_at: new Date().toISOString(),
    });
  } catch {
    /* outbox optional until migration applied */
  }

  console.log(JSON.stringify({ requestId: rid, event: "rsvp_submit", eventId, rsvpId: id }));
  return json(
    {
      rsvp: {
        id,
        eventId,
        guestName,
        response,
        partySize,
        phone: body.phone?.trim() || undefined,
        email: body.email?.trim() || undefined,
        dietary: body.dietary?.trim() || undefined,
        message: body.message?.trim() || undefined,
        createdAt,
      },
    },
    201,
    { requestId: rid },
  );
}

async function handleHostList(req: Request, rid: string): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const userId = await requireUserId(authHeader);
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId")?.trim();
  const eventIdsRaw = url.searchParams.get("eventIds")?.trim();

  const ids = eventId
    ? [eventId]
    : (eventIdsRaw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (!ids.length) {
    return json({ error: "eventId or eventIds is required." }, 400, { requestId: rid });
  }

  const sb = anonClient(authHeader);
  // Verify ownership via events select (RLS: own rows).
  const { data: owned, error: ownErr } = await sb.from("events").select("id").in("id", ids).eq("user_id", userId);
  if (ownErr) return json({ error: ownErr.message }, 500, { requestId: rid });
  const ownedIds = new Set(((owned as { id: string }[]) ?? []).map((r) => r.id));
  const allowed = ids.filter((id) => ownedIds.has(id));
  if (!allowed.length) {
    return json({ rsvps: [] }, 200, { requestId: rid });
  }

  const { data, error } = await sb
    .from("rsvps")
    .select("*")
    .in("event_id", allowed)
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500, { requestId: rid });

  const rsvps = ((data as Record<string, unknown>[]) ?? []).map((row) => ({
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
  }));

  return json({ rsvps }, 200, { requestId: rid });
}
