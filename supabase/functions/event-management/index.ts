// Invana Event Management service — events, guests, passes, check-in, attendance.
// Deploy: `supabase functions deploy event-management`
// Routes: see ../_shared/event-core/router.ts. All business rules live in the shared
// event-core service (also used by Demo Mode and the Vitest API suite); this file only
// resolves the caller from the JWT and wires the service-role repository.
//
// Env (optional): EM_MAX_CAPACITY (default 10000), EM_PASS_BATCH_SIZE (default 50).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { clientIp, requestId } from "../_shared/http.ts";
import { anonClient, serviceClient } from "../_shared/supabase.ts";
import { EventService, handleEventRequest, type Actor } from "../_shared/event-core/index.ts";
import { SupabaseEventRepository } from "./repo.ts";

const service = new EventService(new SupabaseEventRepository(serviceClient()), {
  maxCapacityLimit: Number(Deno.env.get("EM_MAX_CAPACITY")) || undefined,
  passBatchSize: Number(Deno.env.get("EM_PASS_BATCH_SIZE")) || undefined,
});

async function resolveActor(authHeader: string | null): Promise<Actor | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const { data, error } = await anonClient(authHeader).auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email_confirmed_at ? data.user.email ?? null : null };
}

serve(async (req) => {
  const rid = requestId(req);
  const opt = handleOptions(req);
  if (opt) return opt;

  const started = Date.now();
  const actor = await resolveActor(req.headers.get("Authorization"));
  const res = await handleEventRequest(service, req, { actor, ip: clientIp(req), requestId: rid });

  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  headers.set("x-request-id", rid);
  headers.set("Cache-Control", "no-store");
  if (res.status === 429) headers.set("Retry-After", "60");

  console.log(
    JSON.stringify({
      requestId: rid,
      event: "event_management_request",
      method: req.method,
      path: new URL(req.url).pathname.replace(/[A-Za-z0-9_-]{43}/g, ":token"),
      status: res.status,
      userId: actor?.userId ?? null,
      ms: Date.now() - started,
    }),
  );
  return new Response(res.body, { status: res.status, headers });
});
