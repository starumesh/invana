// Invana Invite Read — public GET by slug.
// Deploy: `supabase functions deploy invite`
// Product route: GET /v1/invites/{slug}  (Edge path: /functions/v1/invite?slug=… or /invite/{slug})

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions } from "../_shared/cors.ts";
import { clientIp, json, requestId } from "../_shared/http.ts";
import { toPublicInvite, type EventRow } from "../_shared/inviteProjection.ts";
import { assertRateLimit } from "../_shared/rateLimit.ts";
import { slugKey } from "../_shared/slug.ts";
import { anonClient, serviceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const rid = requestId(req);
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    if (req.method !== "GET") {
      return json({ error: "Method not allowed." }, 405, { requestId: rid });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // …/invite or …/invite/{slug}
    const pathSlug = pathParts[pathParts.length - 1] === "invite"
      ? ""
      : pathParts[pathParts.length - 1] ?? "";
    const rawSlug = url.searchParams.get("slug") || pathSlug;
    const key = slugKey(rawSlug);
    if (!key) {
      return json({ error: "slug is required." }, 400, { requestId: rid });
    }

    const admin = serviceClient();
    const ip = clientIp(req);
    const rl = await assertRateLimit(admin, {
      key: `invite:${ip}`,
      limit: 120,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return json({ error: "Too many requests. Try again shortly." }, 429, {
        requestId: rid,
        headers: { "Retry-After": "60" },
      });
    }

    // Use anon client so published RLS applies; service fallback if needed for exact match.
    const sb = anonClient();
    const { data: exactRow, error: exactErr } = await sb
      .from("events")
      .select("id, user_id, slug, title, status, config, created_at, updated_at")
      .eq("slug", key)
      .maybeSingle();

    if (exactErr) {
      console.error(JSON.stringify({ requestId: rid, msg: "invite_query_failed", error: exactErr.message }));
      return json({ error: exactErr.message }, 500, { requestId: rid });
    }

    let row = exactRow as EventRow | null;
    if (!row || row.status !== "published") {
      const { data, error } = await sb
        .from("events")
        .select("id, user_id, slug, title, status, config, created_at, updated_at")
        .ilike("slug", key);
      if (error) {
        return json({ error: error.message }, 500, { requestId: rid });
      }
      const rows = (data as EventRow[] | null) ?? [];
      row = rows.find((r) => slugKey(r.slug) === key && r.status === "published") ?? null;
    }

    if (!row || row.status !== "published") {
      return json({ error: "Invitation not found." }, 404, { requestId: rid });
    }

    console.log(JSON.stringify({ requestId: rid, event: "invite_view", slug: key, eventId: row.id }));
    return json({ invite: toPublicInvite(row) }, 200, { requestId: rid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(JSON.stringify({ requestId: rid, msg: "invite_unhandled", error: message }));
    return json({ error: message }, 500, { requestId: rid });
  }
});
