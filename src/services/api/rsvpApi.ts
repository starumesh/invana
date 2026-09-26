import { callEdgeFunction } from "@/services/api/edgeClient";
import type { Rsvp } from "@/types";

type RsvpCreateResponse = { rsvp: Rsvp };

/**
 * Public RSVP insert via Edge (rate-limited, published-only).
 * Prefer passing `slug` so the service resolves the published event server-side.
 */
export async function createPublicRsvpViaEdge(
  rsvp: Rsvp,
  opts?: { slug?: string },
): Promise<Rsvp | null> {
  const data = await callEdgeFunction<RsvpCreateResponse>({
    path: "rsvp",
    method: "POST",
    auth: false,
    body: {
      id: rsvp.id,
      eventId: rsvp.eventId,
      slug: opts?.slug,
      guestName: rsvp.guestName,
      response: rsvp.response,
      partySize: rsvp.partySize,
      phone: rsvp.phone,
      email: rsvp.email,
      dietary: rsvp.dietary,
      message: rsvp.message,
      createdAt: rsvp.createdAt,
    },
  });
  return data?.rsvp ?? null;
}

/** Host RSVP list via Edge (JWT). Returns null when Edge unavailable. */
export async function listHostRsvpsViaEdge(eventIds: string[]): Promise<Rsvp[] | null> {
  if (!eventIds.length) return [];
  const data = await callEdgeFunction<{ rsvps: Rsvp[] }>({
    path: `rsvp?eventIds=${encodeURIComponent(eventIds.join(","))}`,
    method: "GET",
    auth: true,
  });
  return data?.rsvps ?? null;
}
