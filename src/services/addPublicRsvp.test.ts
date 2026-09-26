import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Documents the RSVP insert contract: Connected Mode must not swallow cloud
 * failures into localStorage (that hid cross-device RSVPs from the host DB).
 * Prefers RSVP Edge API; falls back to PostgREST persistence.
 */
describe("addPublicRsvp Connected Mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  function mockConnectedBase(opts: {
    addCloud: ReturnType<typeof vi.fn>;
    addLocal: ReturnType<typeof vi.fn>;
    createViaEdge: ReturnType<typeof vi.fn>;
  }) {
    vi.doMock("@/lib/supabase/client", () => ({
      isSupabaseConfigured: () => true,
      getSupabase: () => ({}),
    }));
    vi.doMock("@/services/demo", () => ({
      demoAuth: {},
      demoMessaging: {},
      demoPersistence: { addRsvp: opts.addLocal },
      demoStorage: {},
    }));
    vi.doMock("@/services/demoStorage", () => ({
      demoStorage: {},
    }));
    vi.doMock("@/services/supabase/auth", () => ({
      supabaseAuth: { currentUser: () => null },
    }));
    vi.doMock("@/services/supabase/messaging", () => ({
      cloudMessaging: {},
    }));
    vi.doMock("@/services/supabase/persistence", () => ({
      supabasePersistence: { addRsvp: opts.addCloud },
    }));
    vi.doMock("@/services/supabase/storage", () => ({
      supabaseStorage: {},
    }));
    vi.doMock("@/services/api/inviteApi", () => ({
      fetchPublicInviteBySlug: vi.fn(),
    }));
    vi.doMock("@/services/api/rsvpApi", () => ({
      createPublicRsvpViaEdge: opts.createViaEdge,
    }));
    vi.doMock("@/services/api/edgeClient", () => ({
      EdgeApiError: class EdgeApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
          super(message);
          this.name = "EdgeApiError";
          this.status = status;
        }
      },
    }));
  }

  it("persists to cloud and does not fall back to local-only on cloud error", async () => {
    const cloudError = new Error("new row violates row-level security policy");
    const addCloud = vi.fn().mockRejectedValue(cloudError);
    const addLocal = vi.fn();
    // Edge unavailable → null; PostgREST path must still fail closed (no local-only).
    const createViaEdge = vi.fn().mockResolvedValue(null);

    mockConnectedBase({ addCloud, addLocal, createViaEdge });

    const { addPublicRsvp, isDemoMode } = await import("@/services/index");
    expect(isDemoMode).toBe(false);

    const rsvp = {
      id: "rsvp_1",
      eventId: "evt_1",
      guestName: "Guest",
      response: "yes" as const,
      partySize: 1,
      createdAt: new Date().toISOString(),
    };

    await expect(addPublicRsvp(rsvp)).rejects.toThrow(/row-level security|violates/i);
    expect(addCloud).toHaveBeenCalledWith(rsvp);
    expect(addLocal).not.toHaveBeenCalled();
  });

  it("uses Edge RSVP API when available and mirrors locally", async () => {
    const input = {
      id: "rsvp_2",
      eventId: "evt_2",
      guestName: "Asha",
      response: "maybe" as const,
      partySize: 2,
      createdAt: new Date().toISOString(),
    };
    const addCloud = vi.fn();
    const addLocal = vi.fn().mockResolvedValue(input);
    const createViaEdge = vi.fn().mockResolvedValue(input);

    mockConnectedBase({ addCloud, addLocal, createViaEdge });

    const { addPublicRsvp } = await import("@/services/index");
    await expect(addPublicRsvp(input, { slug: "asha-party" })).resolves.toEqual(input);
    expect(createViaEdge).toHaveBeenCalledWith(input, { slug: "asha-party" });
    expect(addCloud).not.toHaveBeenCalled();
    expect(addLocal).toHaveBeenCalledWith(input);
  });

  it("falls back to PostgREST when Edge returns null and mirrors locally", async () => {
    const input = {
      id: "rsvp_3",
      eventId: "evt_3",
      guestName: "Ravi",
      response: "yes" as const,
      partySize: 1,
      createdAt: new Date().toISOString(),
    };
    const addCloud = vi.fn().mockResolvedValue(input);
    const addLocal = vi.fn().mockResolvedValue(input);
    const createViaEdge = vi.fn().mockResolvedValue(null);

    mockConnectedBase({ addCloud, addLocal, createViaEdge });

    const { addPublicRsvp } = await import("@/services/index");
    await expect(addPublicRsvp(input)).resolves.toEqual(input);
    expect(addCloud).toHaveBeenCalledWith(input);
    expect(addLocal).toHaveBeenCalledWith(input);
  });
});
