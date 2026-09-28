import { EventError, isEventError, MESSAGES } from "./errors.ts";
import type { EventService } from "./service.ts";
import type { AttendanceFilter, RequestContext } from "./types.ts";

/**
 * HTTP surface for Event Management (`/functions/v1/event-management/...`).
 * Runtime-agnostic: takes a standard `Request` and a transport-resolved context,
 * so the Edge function, Demo Mode, and API tests all exercise the same code.
 *
 * Public (anon, rate-limited):
 *   GET    /public/events/:slug
 *   GET    /public/passes/:token
 * Organizer (JWT):
 *   GET    /events                         POST /events
 *   GET    /events/:id                     PATCH /events/:id
 *   POST   /events/:id/(publish|unpublish|cancel|complete)
 *   POST   /events/:id/guests              PATCH|DELETE /events/:id/guests/:guestId
 *   POST   /events/:id/guests/:guestId/share
 *   POST   /events/:id/passes/generate     GET /events/:id/passes/export
 *   POST   /events/:id/passes/:passId/(cancel|reissue)
 *   GET    /events/:id/attendance?filter=&q=
 *   GET|POST /events/:id/staff             DELETE /events/:id/staff/:staffId
 * Organizer or assigned staff (JWT):
 *   GET    /events/:id/check-in            POST /events/:id/check-in
 *   GET    /events/:id/check-in/search?q=
 */

const JSON_HEADERS = { "Content-Type": "application/json" };
const MAX_BODY_BYTES = 2_000_000;

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  if (text.length > MAX_BODY_BYTES) throw new EventError("VALIDATION", "Request is too large.");
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new EventError("VALIDATION", "Request body must be a JSON object.");
  }
}

/** Strip everything up to and including the function name. */
export function routePath(url: URL, functionName = "event-management"): string[] {
  const parts = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  const at = parts.indexOf(functionName);
  return at >= 0 ? parts.slice(at + 1) : parts;
}

const FILTERS: AttendanceFilter[] = ["ALL", "CHECKED_IN", "NOT_CHECKED_IN", "CANCELLED"];
const TRANSITIONS = { publish: "PUBLISHED", unpublish: "DRAFT", cancel: "CANCELLED", complete: "COMPLETED" } as const;

export async function handleEventRequest(service: EventService, req: Request, ctx: RequestContext): Promise<Response> {
  try {
    const url = new URL(req.url);
    const p = routePath(url);
    const m = req.method.toUpperCase();

    if (p[0] === "config" && m === "GET") {
      return respond({ maxCapacityLimit: service.capacityLimit });
    }

    if (p[0] === "public") {
      if (m !== "GET") return respond({ error: "Method not allowed." }, 405);
      if (p[1] === "events" && p[2] && p.length === 3) return respond({ event: await service.getPublicEvent(ctx, p[2]) });
      if (p[1] === "passes" && p[2] && p.length === 3) return respond(await service.getGuestPass(ctx, p[2]));
      return respond({ error: "Not found." }, 404);
    }

    if (p[0] !== "events") return respond({ error: "Not found." }, 404);

    if (p.length === 1) {
      if (m === "GET") return respond({ events: await service.listMyEvents(ctx) });
      if (m === "POST") {
        const body = await readBody(req);
        const detail = await service.createEvent(ctx, {
          details: (body.details ?? {}) as never,
          timeline: body.timeline as never,
          guests: body.guests as never,
        });
        return respond(detail, 201);
      }
    }

    const id = p[1];
    if (!id) return respond({ error: "Not found." }, 404);

    if (p.length === 2) {
      if (m === "GET") return respond(await service.getEventDetail(ctx, id));
      if (m === "PATCH") {
        const body = await readBody(req);
        return respond(await service.updateEvent(ctx, id, { details: body.details as never, timeline: body.timeline as never }));
      }
    }

    const section = p[2];
    if (p.length === 3 && m === "POST" && section in TRANSITIONS) {
      const to = TRANSITIONS[section as keyof typeof TRANSITIONS];
      return respond({ event: await service.transitionEvent(ctx, id, to) });
    }

    if (section === "guests") {
      if (p.length === 3 && m === "POST") {
        const body = await readBody(req);
        return respond({ guests: await service.addGuests(ctx, id, (body.guests ?? []) as never) }, 201);
      }
      const guestId = p[3];
      if (guestId && p.length === 4 && m === "PATCH") {
        return respond({ guest: await service.updateGuest(ctx, id, guestId, (await readBody(req)) as never) });
      }
      if (guestId && p.length === 4 && m === "DELETE") return respond(await service.removeGuest(ctx, id, guestId));
      if (guestId && p[4] === "share" && m === "POST") return respond(await service.sharePass(ctx, id, guestId));
    }

    if (section === "passes") {
      if (p[3] === "generate" && m === "POST") {
        const body = await readBody(req);
        return respond(await service.generatePasses(ctx, id, { batchSize: Number(body.batchSize) || undefined }));
      }
      if (p[3] === "export" && m === "GET") return respond({ passes: await service.exportPassLinks(ctx, id) });
      const passId = p[3];
      if (passId && p[4] === "cancel" && m === "POST") return respond({ pass: redactPass(await service.cancelPass(ctx, id, passId)) });
      if (passId && p[4] === "reissue" && m === "POST") return respond({ pass: redactPass(await service.reissuePass(ctx, id, passId)) });
    }

    if (section === "check-in") {
      if (p.length === 3 && m === "GET") return respond(await service.checkInContext(ctx, id));
      if (p.length === 3 && m === "POST") {
        const body = await readBody(req);
        return respond(
          await service.checkIn(ctx, id, { payload: body.payload, passPublicId: body.passPublicId, guestId: body.guestId }),
        );
      }
      if (p[3] === "search" && m === "GET") {
        return respond({ results: await service.searchGuests(ctx, id, url.searchParams.get("q") ?? "") });
      }
    }

    if (section === "attendance" && m === "GET") {
      const rawFilter = (url.searchParams.get("filter") ?? "ALL").toUpperCase() as AttendanceFilter;
      return respond(
        await service.getAttendance(ctx, id, {
          filter: FILTERS.includes(rawFilter) ? rawFilter : "ALL",
          q: url.searchParams.get("q") ?? "",
        }),
      );
    }

    if (section === "staff") {
      if (p.length === 3 && m === "GET") return respond({ staff: await service.listStaff(ctx, id) });
      if (p.length === 3 && m === "POST") {
        const body = await readBody(req);
        return respond({ staff: await service.addStaff(ctx, id, body.email) }, 201);
      }
      if (p[3] && p.length === 4 && m === "DELETE") {
        await service.removeStaff(ctx, id, p[3]);
        return respond({ ok: true });
      }
    }

    return respond({ error: "Not found." }, 404);
  } catch (err) {
    if (isEventError(err)) {
      return respond(
        {
          error: err.message,
          code: err.code,
          ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
          ...(err.details ? { details: err.details } : {}),
        },
        err.status,
      );
    }
    console.error(JSON.stringify({ msg: "event_management_unhandled", requestId: ctx.requestId, error: String(err) }));
    return respond({ error: "The server could not complete this request. Please try again.", code: "INTERNAL" }, 500);
  }
}

function redactPass<T extends { secureToken?: string }>(pass: T): Omit<T, "secureToken"> {
  const { secureToken: _t, ...rest } = pass;
  return rest;
}

export { MESSAGES };
