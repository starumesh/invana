// Invana Events service — thin host publish helper (logical Events API).
// Deploy: `supabase functions deploy events`
// Product: POST /v1/events/{id}/publish with durable-media enforcement.
// Host CRUD remains via PersistenceProvider → PostgREST for Phase 1.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions } from "../_shared/cors.ts";
import { json, readJson, requestId } from "../_shared/http.ts";
import { slugKey } from "../_shared/slug.ts";
import { anonClient, requireUserId } from "../_shared/supabase.ts";

type PublishBody = {
  eventId: string;
  slug: string;
  /** Full event row fields the client already prepared (config must use durable URLs). */
  title?: string;
  config?: Record<string, unknown>;
};

function findLocalMediaUrls(fields: Record<string, unknown> | undefined): string[] {
  if (!fields || typeof fields !== "object") return [];
  const bad: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string") continue;
    const v = value.trim();
    if (v.startsWith("blob:") || v.startsWith("data:")) bad.push(key);
  }
  return bad;
}

serve(async (req) => {
  const rid = requestId(req);
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405, { requestId: rid });
    }

    const authHeader = req.headers.get("Authorization");
    const userId = await requireUserId(authHeader);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "publish";
    const body = await readJson<PublishBody>(req);
    const eventId = (body.eventId || "").trim();
    if (!eventId) {
      return json({ error: "eventId is required." }, 400, { requestId: rid });
    }

    const sb = anonClient(authHeader);
    const { data: existing, error: loadErr } = await sb
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (loadErr) return json({ error: loadErr.message }, 500, { requestId: rid });
    if (!existing) return json({ error: "Event not found." }, 404, { requestId: rid });

    if (action === "unpublish") {
      const { data, error } = await sb
        .from("events")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", eventId)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400, { requestId: rid });
      return json({ event: data }, 200, { requestId: rid });
    }

    const slug = slugKey(body.slug || (existing.slug as string));
    if (!slug) {
      return json({ error: "slug is required." }, 400, { requestId: rid });
    }

    const config = (body.config ?? existing.config) as Record<string, unknown>;
    const fields = (config?.fields ?? {}) as Record<string, unknown>;
    const localKeys = findLocalMediaUrls(fields);
    if (localKeys.length) {
      return json(
        {
          error:
            "Publish requires durable HTTPS photo URLs. Re-save after sign-in so photos upload to storage.",
          fields: localKeys,
        },
        400,
        { requestId: rid },
      );
    }

    // Slug conflict → 409
    const { data: conflict } = await sb
      .from("events")
      .select("id")
      .eq("slug", slug)
      .neq("id", eventId)
      .maybeSingle();
    if (conflict?.id) {
      return json({ error: "That invite link is already taken." }, 409, { requestId: rid });
    }

    const title = (body.title || existing.title || slug) as string;
    const { data, error } = await sb
      .from("events")
      .update({
        slug,
        title,
        status: "published",
        config,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        return json({ error: "That invite link is already taken." }, 409, { requestId: rid });
      }
      return json({ error: error.message }, 400, { requestId: rid });
    }

    console.log(JSON.stringify({ requestId: rid, event: "event_publish", eventId, slug, userId }));
    return json({ event: data }, 200, { requestId: rid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHORIZED") {
      return json({ error: "Unauthorized." }, 401, { requestId: rid });
    }
    console.error(JSON.stringify({ requestId: rid, msg: "events_unhandled", error: message }));
    return json({ error: message }, 500, { requestId: rid });
  }
});
