// Integration test: real SupabaseEventRepository + router against Postgres via PostgREST.
// Run with supabase/tests/run-integration.sh (spins up a throwaway DB + PostgREST).
//   EM_IT_REST_URL   PostgREST base URL (e.g. http://localhost:3999)
//   EM_IT_JWT        service_role JWT for that PostgREST instance
import { PostgrestClient } from "https://esm.sh/@supabase/postgrest-js@1.16.3";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { encodeQrPayload, EventService, handleEventRequest, type Actor } from "../_shared/event-core/index.ts";
import { SupabaseEventRepository } from "./repo.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const REST = Deno.env.get("EM_IT_REST_URL");
const JWT = Deno.env.get("EM_IT_JWT");

const ORGANIZER: Actor = { userId: "00000000-0000-4000-8000-00000000000a", email: "host@example.com" };
const STAFF: Actor = { userId: "00000000-0000-4000-8000-00000000000b", email: "door@example.com" };
const STRANGER: Actor = { userId: "00000000-0000-4000-8000-00000000000c", email: "nosy@example.com" };

Deno.test({
  name: "event-management against Postgres",
  ignore: !REST || !JWT,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const client = new PostgrestClient(REST!, { headers: { Authorization: `Bearer ${JWT}` } }) as unknown as SupabaseClient;
    const service = new EventService(new SupabaseEventRepository(client), { passBatchSize: 2 });
    let ipCounter = 0;
    const call = async (actor: Actor | null, method: string, path: string, body?: unknown) => {
      const req = new Request(`http://edge/functions/v1/event-management${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const res = await handleEventRequest(service, req, { actor, ip: `10.1.0.${ipCounter++ % 250}`, requestId: "it" });
      return { status: res.status, body: await res.json() };
    };

    const start = new Date(Date.now() + 7 * 86400_000);
    const date = start.toISOString().slice(0, 10);
    const details = {
      name: "Integration Meetup",
      description: "Real DB",
      eventType: "Meetup",
      date,
      startTime: "10:00",
      timezone: "UTC",
      durationMinutes: 240,
      venueName: "Hall",
      address: "1 Main St",
      city: "Hyderabad",
      country: "India",
      latitude: 17.4,
      longitude: 78.4,
      maxCapacity: 3,
    };

    const created = await call(ORGANIZER, "POST", "/events", {
      details,
      timeline: [{ title: "Opening", startTime: `${date}T10:00:00.000Z`, endTime: `${date}T11:00:00.000Z` }],
      guests: [
        { name: "Asha", email: "asha@example.com", role: "Speaker" },
        { name: "Bala", phone: "+91 98000 00002" },
      ],
    });
    assert(created.status === 201, `create ${JSON.stringify(created.body)}`);
    const id = created.body.event.id as string;
    assert(created.body.timeline.length === 1, "timeline stored");
    assert(created.body.guests.length === 2, "guests stored");

    const dup = await call(ORGANIZER, "POST", `/events/${id}/guests`, { guests: [{ name: "Asha 2", email: "ASHA@example.com" }] });
    assert(dup.status === 409, "duplicate guest");
    await call(ORGANIZER, "POST", `/events/${id}/guests`, { guests: [{ name: "Chitra" }] });
    const full = await call(ORGANIZER, "POST", `/events/${id}/guests`, { guests: [{ name: "Dev" }] });
    assert(full.status === 409 && full.body.code === "CAPACITY_REACHED", `capacity ${JSON.stringify(full.body)}`);

    const g1 = await call(ORGANIZER, "POST", `/events/${id}/passes/generate`, {});
    assert(g1.body.generated === 2 && g1.body.pending === 1, `batch 1 ${JSON.stringify(g1.body)}`);
    const g2 = await call(ORGANIZER, "POST", `/events/${id}/passes/generate`, {});
    assert(g2.body.pending === 0, "batch 2");

    const pub = await call(ORGANIZER, "POST", `/events/${id}/publish`);
    assert(pub.status === 200 && pub.body.event.slug, "publish");
    const publicView = await call(null, "GET", `/public/events/${pub.body.event.slug}`);
    assert(publicView.status === 200 && !JSON.stringify(publicView.body).includes("asha@example.com"), "public view");

    const detail = await call(ORGANIZER, "GET", `/events/${id}`);
    assert(detail.body.stats.passesIssued === 3, `stats ${JSON.stringify(detail.body.stats)}`);
    const asha = detail.body.guests.find((g: { name: string }) => g.name === "Asha");
    const share = await call(ORGANIZER, "POST", `/events/${id}/guests/${asha.id}/share`);
    const token = share.body.passToken as string;
    const guestPass = await call(null, "GET", `/public/passes/${token}`);
    assert(guestPass.status === 200 && guestPass.body.guest.name === "Asha", "guest pass");

    assert((await call(STAFF, "POST", `/events/${id}/check-in`, { payload: encodeQrPayload(id, token) })).status === 403, "unassigned staff");
    await call(ORGANIZER, "POST", `/events/${id}/staff`, { email: "door@example.com" });

    // Concurrent scans of the same pass: exactly one attendance row.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => call(STAFF, "POST", `/events/${id}/check-in`, { payload: encodeQrPayload(id, token) })),
    );
    const codes = results.map((r) => r.body.result);
    assert(codes.filter((c) => c === "CHECKED_IN").length === 1, `one success: ${codes}`);
    assert(codes.filter((c) => c === "ALREADY_CHECKED_IN").length === 7, `rest duplicate: ${codes}`);

    const invalid = await call(STAFF, "POST", `/events/${id}/check-in`, { payload: "nope" });
    assert(invalid.body.result === "INVALID", "invalid");

    const bala = detail.body.guests.find((g: { name: string }) => g.name === "Bala");
    await call(ORGANIZER, "POST", `/events/${id}/passes/${bala.pass.id}/cancel`);
    const balaToken = (await call(ORGANIZER, "POST", `/events/${id}/guests/${bala.id}/share`)).status;
    assert(balaToken === 409, "cancelled pass cannot be shared");

    const search = await call(STAFF, "GET", `/events/${id}/check-in/search?q=chitra`);
    assert(search.body.results.length === 1, "staff search");
    const byId = await call(STAFF, "POST", `/events/${id}/check-in`, { passPublicId: search.body.results[0].passPublicId });
    assert(byId.body.result === "CHECKED_IN", `check-in by pass id ${JSON.stringify(byId.body)}`);

    const other = await call(ORGANIZER, "POST", "/events", { details: { ...details, name: "Other" }, guests: [{ name: "Zed" }] });
    const otherId = other.body.event.id as string;
    await call(ORGANIZER, "POST", `/events/${otherId}/passes/generate`, {});
    await call(ORGANIZER, "POST", `/events/${otherId}/publish`);
    const zed = (await call(ORGANIZER, "GET", `/events/${otherId}`)).body.guests[0];
    const zedToken = (await call(ORGANIZER, "POST", `/events/${otherId}/guests/${zed.id}/share`)).body.passToken;
    const wrong = await call(STAFF, "POST", `/events/${id}/check-in`, { payload: encodeQrPayload(otherId, zedToken) });
    assert(wrong.body.result === "WRONG_EVENT", "wrong event");

    const attendance = await call(ORGANIZER, "GET", `/events/${id}/attendance`);
    assert(attendance.body.stats.checkedIn === 2 && attendance.body.stats.invited === 2, `attendance ${JSON.stringify(attendance.body.stats)}`);
    assert(attendance.body.recent.length === 2, "recent check-ins");
    assert((await call(STRANGER, "GET", `/events/${id}/attendance`)).status === 403, "stranger attendance");
    assert((await call(STAFF, "GET", `/events/${id}/attendance`)).status === 403, "staff attendance");

    const mine = await call(STAFF, "GET", "/events");
    assert(mine.body.events.length === 1 && mine.body.events[0].access === "STAFF", "staff sees assigned event");

    const audit = await (client as unknown as PostgrestClient).from("em_audit_log").select("action,result").eq("event_id", id);
    const actions = (audit.data ?? []).map((a: { action: string }) => a.action);
    assert(actions.includes("event.create") && actions.includes("checkin.attempt") && actions.includes("pass.generate"), `audit ${actions}`);
  },
});
