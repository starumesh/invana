import { beforeEach, describe, expect, it } from "vitest";
import {
  encodeQrPayload,
  EventService,
  handleEventRequest,
  MemoryEventRepository,
  secureToken,
  type Actor,
  type CheckInResult,
  type EventDetail,
} from "@event-core";

const ORGANIZER: Actor = { userId: "11111111-1111-4111-8111-111111111111", email: "host@example.com" };
const STAFF: Actor = { userId: "22222222-2222-4222-8222-222222222222", email: "door@example.com" };
const STRANGER: Actor = { userId: "33333333-3333-4333-8333-333333333333", email: "nosy@example.com" };

const details = {
  name: "Tech Meetup",
  description: "Monthly meetup",
  eventType: "Meetup",
  date: "2027-03-10",
  startTime: "18:00",
  timezone: "Asia/Kolkata",
  durationMinutes: 180,
  venueName: "T-Hub",
  address: "IIIT Campus",
  city: "Hyderabad",
  country: "India",
  latitude: 17.44,
  longitude: 78.35,
  maxCapacity: 3,
};

let repo: MemoryEventRepository;
let service: EventService;

async function call<T = Record<string, unknown>>(
  actor: Actor | null,
  method: string,
  path: string,
  body?: unknown,
  ip = "10.0.0.1",
): Promise<{ status: number; body: T }> {
  const req = new Request(`https://x.supabase.co/functions/v1/event-management${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handleEventRequest(service, req, { actor, ip, requestId: "test" });
  return { status: res.status, body: (await res.json()) as T };
}

async function createPublished(guests: Record<string, string>[] = [{ name: "Asha", email: "asha@example.com", role: "Speaker" }, { name: "Bala", phone: "9800000002" }]) {
  const created = await call<EventDetail>(ORGANIZER, "POST", "/events", {
    details,
    timeline: [{ title: "Talks", startTime: "2027-03-10T12:30:00.000Z", endTime: "2027-03-10T14:00:00.000Z" }],
    guests,
  });
  expect(created.status).toBe(201);
  const id = created.body.event.id;
  const gen = await call(ORGANIZER, "POST", `/events/${id}/passes/generate`, {});
  expect(gen.status).toBe(200);
  const pub = await call<{ event: EventDetail["event"] }>(ORGANIZER, "POST", `/events/${id}/publish`);
  expect(pub.status).toBe(200);
  return { id, event: pub.body.event };
}

async function tokenFor(eventId: string, guestName: string) {
  const detail = await call<EventDetail>(ORGANIZER, "GET", `/events/${eventId}`);
  const guest = detail.body.guests.find((g) => g.name === guestName)!;
  const share = await call<{ passToken: string }>(ORGANIZER, "POST", `/events/${eventId}/guests/${guest.id}/share`);
  return { token: share.body.passToken, guest };
}

beforeEach(() => {
  repo = new MemoryEventRepository();
  service = new EventService(repo, { now: () => new Date("2027-01-01T00:00:00.000Z"), passBatchSize: 2 });
});

describe("event API", () => {
  it("creates a DRAFT event with UUID id, random public id, timeline and guests", async () => {
    const res = await call<EventDetail>(ORGANIZER, "POST", "/events", { details, guests: [{ name: "Asha" }] });
    expect(res.status).toBe(201);
    expect(res.body.event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.event.publicId).toMatch(/^INV-EVT-2027-[0-9A-Z]{6}$/);
    expect(res.body.event.status).toBe("DRAFT");
    expect(res.body.event.slug).toBeNull();
    expect(res.body.event.createdBy).toBe(ORGANIZER.userId);
    expect(res.body.guests).toHaveLength(1);
    expect(repo.data.audit.some((a) => a.action === "event.create")).toBe(true);
  });

  it("returns field errors with a specific message", async () => {
    const res = await call<{ error: string; fieldErrors: Record<string, string> }>(ORGANIZER, "POST", "/events", {
      details: { ...details, maxCapacity: 0, name: "" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Unable to create the event. Please check the required fields.");
    expect(res.body.fieldErrors.maxCapacity).toBeTruthy();
    expect(res.body.fieldErrors.name).toBeTruthy();
  });

  it("ignores client-supplied ownership and status", async () => {
    const res = await call<EventDetail>(ORGANIZER, "POST", "/events", {
      details: { ...details, status: "PUBLISHED", createdBy: STRANGER.userId },
    });
    expect(res.body.event.status).toBe("DRAFT");
    expect(res.body.event.createdBy).toBe(ORGANIZER.userId);
  });

  it("updates details and rejects capacity below current guests", async () => {
    const { body } = await call<EventDetail>(ORGANIZER, "POST", "/events", { details, guests: [{ name: "A" }, { name: "B" }] });
    const ok = await call<EventDetail>(ORGANIZER, "PATCH", `/events/${body.event.id}`, { details: { ...details, name: "Renamed" } });
    expect(ok.status).toBe(200);
    expect(ok.body.event.name).toBe("Renamed");
    const bad = await call<{ fieldErrors: Record<string, string> }>(ORGANIZER, "PATCH", `/events/${body.event.id}`, {
      details: { ...details, maxCapacity: 1 },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.fieldErrors.maxCapacity).toMatch(/2 guests/);
  });

  it("publishes with a readable slug and exposes a PII-free public page", async () => {
    const { event } = await createPublished();
    expect(event.status).toBe("PUBLISHED");
    expect(event.slug).toMatch(/^tech-meetup-2027-/);
    const pub = await call<{ event: Record<string, unknown> }>(null, "GET", `/public/events/${event.slug}`);
    expect(pub.status).toBe(200);
    const text = JSON.stringify(pub.body);
    expect(text).not.toContain("asha@example.com");
    expect(text).not.toContain("9800000002");
    expect(text).not.toContain("createdBy");
    expect(text).not.toContain(event.id);
    expect(pub.body.event.featuredGuests).toEqual([{ name: "Asha", role: "SPEAKER" }]);
  });

  it("hides drafts from the public", async () => {
    const { body } = await call<EventDetail>(ORGANIZER, "POST", "/events", { details });
    await call(ORGANIZER, "POST", `/events/${body.event.id}/publish`);
    const published = (await repo.getEvent(body.event.id))!;
    await call(ORGANIZER, "POST", `/events/${body.event.id}/unpublish`);
    const res = await call(null, "GET", `/public/events/${published.slug}`);
    expect(res.status).toBe(404);
  });

  it("blocks invalid status transitions", async () => {
    const { body } = await call<EventDetail>(ORGANIZER, "POST", "/events", { details });
    await call(ORGANIZER, "POST", `/events/${body.event.id}/cancel`);
    const res = await call(ORGANIZER, "POST", `/events/${body.event.id}/publish`);
    expect(res.status).toBe(409);
  });

  it("rejects unauthenticated and non-owner access identically", async () => {
    const { body } = await call<EventDetail>(ORGANIZER, "POST", "/events", { details });
    expect((await call(null, "GET", `/events/${body.event.id}`)).status).toBe(401);
    const other = await call<{ error: string }>(STRANGER, "GET", `/events/${body.event.id}`);
    const missing = await call<{ error: string }>(STRANGER, "GET", `/events/00000000-0000-4000-8000-000000000000`);
    expect(other.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(other.body.error).toBe("You don't have permission to access this event.");
    expect(missing.body).toEqual(other.body);
    expect((await call(STRANGER, "PATCH", `/events/${body.event.id}`, { details })).status).toBe(403);
    expect((await call(STRANGER, "POST", `/events/${body.event.id}/publish`)).status).toBe(403);
  });
});

describe("guest API", () => {
  it("adds guests and rejects duplicates and over-capacity", async () => {
    const { body } = await call<EventDetail>(ORGANIZER, "POST", "/events", { details, guests: [{ name: "Asha", email: "asha@example.com" }] });
    const id = body.event.id;
    const dup = await call<{ error: string }>(ORGANIZER, "POST", `/events/${id}/guests`, { guests: [{ name: "Asha R", email: "ASHA@example.com" }] });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("This guest is already registered for this event.");
    const add = await call(ORGANIZER, "POST", `/events/${id}/guests`, { guests: [{ name: "B" }, { name: "C" }] });
    expect(add.status).toBe(201);
    const full = await call<{ error: string; code: string }>(ORGANIZER, "POST", `/events/${id}/guests`, { guests: [{ name: "D" }] });
    expect(full.status).toBe(409);
    expect(full.body.error).toBe("Maximum event capacity has been reached.");
  });

  it("rejects guests over capacity at creation", async () => {
    const res = await call(ORGANIZER, "POST", "/events", { details, guests: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }] });
    expect(res.status).toBe(409);
  });

  it("edits and removes guests", async () => {
    const { body } = await call<EventDetail>(ORGANIZER, "POST", "/events", { details, guests: [{ name: "A" }, { name: "B" }] });
    const [a, b] = body.guests;
    const edit = await call<{ guest: { role: string } }>(ORGANIZER, "PATCH", `/events/${body.event.id}/guests/${a.id}`, { name: "A", role: "VIP" });
    expect(edit.body.guest.role).toBe("VIP");
    const clash = await call(ORGANIZER, "PATCH", `/events/${body.event.id}/guests/${a.id}`, { name: "B" });
    expect(clash.status).toBe(409);
    const del = await call<{ removed: string }>(ORGANIZER, "DELETE", `/events/${body.event.id}/guests/${b.id}`);
    expect(del.body.removed).toBe("DELETED");
  });
});

describe("pass API", () => {
  it("generates one pass per guest in batches with progress", async () => {
    const { body } = await call<EventDetail>(ORGANIZER, "POST", "/events", { details, guests: [{ name: "A" }, { name: "B" }, { name: "C" }] });
    const id = body.event.id;
    const first = await call(ORGANIZER, "POST", `/events/${id}/passes/generate`, {});
    expect(first.body).toMatchObject({ generated: 2, issued: 2, total: 3, pending: 1 });
    const second = await call(ORGANIZER, "POST", `/events/${id}/passes/generate`, {});
    expect(second.body).toMatchObject({ generated: 1, issued: 3, total: 3, pending: 0 });
    const third = await call(ORGANIZER, "POST", `/events/${id}/passes/generate`, {});
    expect(third.body).toMatchObject({ generated: 0, pending: 0 });
    const passes = repo.data.passes;
    expect(new Set(passes.map((p) => p.guestId)).size).toBe(3);
    expect(new Set(passes.map((p) => p.secureToken)).size).toBe(3);
    for (const p of passes) expect(p.publicId).toMatch(/^INV-PASS-[0-9A-F]{8}$/);
  });

  it("never leaks secure tokens in organizer list responses", async () => {
    const { id } = await createPublished();
    const detail = await call(ORGANIZER, "GET", `/events/${id}`);
    for (const p of repo.data.passes) expect(JSON.stringify(detail.body)).not.toContain(p.secureToken);
  });

  it("lets a guest retrieve only their own pass via token", async () => {
    const { id } = await createPublished();
    const { token } = await tokenFor(id, "Asha");
    const res = await call<{ guest: { name: string }; qrPayload: string; pass: { publicId: string } }>(null, "GET", `/public/passes/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.guest.name).toBe("Asha");
    expect(JSON.parse(res.body.qrPayload)).toEqual({ v: 1, eventId: id, passToken: token });
    expect(JSON.stringify(res.body)).not.toContain("asha@example.com");
    expect(JSON.stringify(res.body)).not.toContain("Bala");
    const guess = await call<{ error: string }>(null, "GET", `/public/passes/${secureToken()}`);
    expect(guess.status).toBe(404);
  });

  it("rate-limits pass enumeration", async () => {
    let last = 0;
    for (let i = 0; i < 25; i += 1) last = (await call(null, "GET", `/public/passes/${secureToken()}`, undefined, "9.9.9.9")).status;
    expect(last).toBe(429);
  });

  it("reissuing rotates the token so old links stop working", async () => {
    const { id } = await createPublished();
    const { token, guest } = await tokenFor(id, "Asha");
    await call(ORGANIZER, "POST", `/events/${id}/passes/${guest.pass!.id}/reissue`);
    expect((await call(null, "GET", `/public/passes/${token}`)).status).toBe(404);
  });
});

describe("check-in API", () => {
  async function scan(actor: Actor | null, eventId: string, payload: string) {
    return call<CheckInResult>(actor, "POST", `/events/${eventId}/check-in`, { payload });
  }

  it("checks in a valid pass and records attendance", async () => {
    const { id } = await createPublished();
    const { token } = await tokenFor(id, "Asha");
    const res = await scan(ORGANIZER, id, encodeQrPayload(id, token));
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("CHECKED_IN");
    expect(res.body.guest).toEqual({ name: "Asha", role: "SPEAKER" });
    expect(res.body.pass?.publicId).toMatch(/^INV-PASS-/);
    expect(res.body.checkedInAt).toBe("2027-01-01T00:00:00.000Z");
    expect(repo.data.attendance).toHaveLength(1);
    expect(repo.data.attendance[0]).toMatchObject({ eventId: id, checkedInBy: ORGANIZER.userId, scanType: "CHECK_IN" });
    expect(repo.data.passes.find((p) => p.secureToken === token)?.status).toBe("CHECKED_IN");
  });

  it("reports duplicates with the original time and no new record", async () => {
    const { id } = await createPublished();
    const { token } = await tokenFor(id, "Asha");
    await scan(ORGANIZER, id, encodeQrPayload(id, token));
    const again = await scan(ORGANIZER, id, encodeQrPayload(id, token));
    expect(again.body.result).toBe("ALREADY_CHECKED_IN");
    expect(again.body.title).toBe("Already Checked In");
    expect(again.body.checkedInAt).toBe("2027-01-01T00:00:00.000Z");
    expect(repo.data.attendance).toHaveLength(1);
  });

  it("rejects invalid, tampered and unknown payloads", async () => {
    const { id } = await createPublished();
    const { token } = await tokenFor(id, "Asha");
    for (const payload of ["garbage", encodeQrPayload(id, secureToken()), encodeQrPayload("5b1f0c1e-8f5d-4c61-9d34-2c1c4b0f6a11", token)]) {
      const res = await scan(ORGANIZER, id, payload);
      expect(res.body.result).toBe("INVALID");
      expect(res.body.message).toBe("This pass could not be verified. Please scan a valid Invana event pass.");
    }
    expect(repo.data.attendance).toHaveLength(0);
  });

  it("rejects cancelled passes", async () => {
    const { id } = await createPublished();
    const { token, guest } = await tokenFor(id, "Bala");
    await call(ORGANIZER, "POST", `/events/${id}/passes/${guest.pass!.id}/cancel`);
    const res = await scan(ORGANIZER, id, encodeQrPayload(id, token));
    expect(res.body.result).toBe("CANCELLED");
    expect(res.body.title).toBe("Pass Cancelled");
  });

  it("rejects passes from another event", async () => {
    const a = await createPublished();
    const b = await createPublished([{ name: "Zed" }]);
    const { token } = await tokenFor(b.id, "Zed");
    const res = await scan(ORGANIZER, a.id, encodeQrPayload(b.id, token));
    expect(res.body.result).toBe("WRONG_EVENT");
    expect(res.body.message).toBe("This pass does not belong to this event.");
    expect(res.body.guest).toBeUndefined();
  });

  it("does not check in while the event is a draft", async () => {
    const { body } = await call<EventDetail>(ORGANIZER, "POST", "/events", { details, guests: [{ name: "A" }] });
    await call(ORGANIZER, "POST", `/events/${body.event.id}/passes/generate`, {});
    const { token } = await tokenFor(body.event.id, "A");
    const res = await scan(ORGANIZER, body.event.id, encodeQrPayload(body.event.id, token));
    expect(res.body.result).toBe("EVENT_NOT_ACTIVE");
  });

  it("allows assigned staff and blocks everyone else", async () => {
    const { id } = await createPublished();
    const { token } = await tokenFor(id, "Asha");
    const payload = encodeQrPayload(id, token);
    expect((await scan(null, id, payload)).status).toBe(401);
    const denied = await scan(STAFF, id, payload);
    expect(denied.status).toBe(403);
    expect((denied.body as unknown as { error: string }).error).toBe("You don't have permission to access this event.");

    const added = await call(ORGANIZER, "POST", `/events/${id}/staff`, { email: "DOOR@example.com" });
    expect(added.status).toBe(201);
    const ok = await scan(STAFF, id, payload);
    expect(ok.body.result).toBe("CHECKED_IN");
    expect(repo.data.attendance[0].checkedInBy).toBe(STAFF.userId);
    expect(repo.data.staff[0].userId).toBe(STAFF.userId);

    expect((await call(STAFF, "GET", `/events/${id}`)).status).toBe(403);
    expect((await call(STAFF, "GET", `/events/${id}/attendance`)).status).toBe(403);
    expect((await call(STAFF, "POST", `/events/${id}/guests/${repo.data.guests[0].id}/share`)).status).toBe(403);
    expect((await scan(STRANGER, id, payload)).status).toBe(403);
    expect(repo.data.audit.filter((a) => a.action === "event.access_denied").length).toBeGreaterThan(0);
  });

  it("supports staff search with masked contact details and check-in by pass id", async () => {
    const { id } = await createPublished();
    await call(ORGANIZER, "POST", `/events/${id}/staff`, { email: STAFF.email });
    const search = await call<{ results: { name: string; maskedEmail: string; maskedPhone: string; passPublicId: string; guestId: string }[] }>(
      STAFF,
      "GET",
      `/events/${id}/check-in/search?q=9800000002`,
    );
    expect(search.body.results).toHaveLength(1);
    expect(search.body.results[0].maskedPhone).toBe("•••• 0002");
    expect(JSON.stringify(search.body)).not.toContain("9800000002");
    const byEmail = await call<{ results: { maskedEmail: string }[] }>(STAFF, "GET", `/events/${id}/check-in/search?q=asha@example.com`);
    expect(byEmail.body.results[0].maskedEmail).toBe("a•••@example.com");
    const res = await call<CheckInResult>(STAFF, "POST", `/events/${id}/check-in`, { passPublicId: search.body.results[0].passPublicId.toLowerCase() });
    expect(res.body.result).toBe("CHECKED_IN");
    const byGuest = await call<CheckInResult>(STAFF, "POST", `/events/${id}/check-in`, { guestId: search.body.results[0].guestId });
    expect(byGuest.body.result).toBe("ALREADY_CHECKED_IN");
  });

  it("feeds the attendance dashboard", async () => {
    const { id } = await createPublished();
    const { token } = await tokenFor(id, "Asha");
    await scan(ORGANIZER, id, encodeQrPayload(id, token));
    const res = await call<{ stats: Record<string, number>; recent: { name: string }[]; rows: unknown[] }>(ORGANIZER, "GET", `/events/${id}/attendance`);
    expect(res.body.stats).toMatchObject({ maxCapacity: 3, invited: 2, checkedIn: 1, notCheckedIn: 1, attendancePercent: 50 });
    expect(res.body.recent.map((r) => r.name)).toEqual(["Asha"]);
    const notIn = await call<{ rows: { name: string }[] }>(ORGANIZER, "GET", `/events/${id}/attendance?filter=not_checked_in`);
    expect(notIn.body.rows.map((r) => r.name)).toEqual(["Bala"]);
  });

  it("writes an audit entry for every check-in attempt", async () => {
    const { id } = await createPublished();
    await scan(ORGANIZER, id, "garbage");
    const attempts = repo.data.audit.filter((a) => a.action === "checkin.attempt");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ result: "INVALID", actorUserId: ORGANIZER.userId, ip: "10.0.0.1" });
  });
});
