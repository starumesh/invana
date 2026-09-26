import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Documents the RSVP insert contract: Connected Mode must not swallow cloud
 * failures into localStorage (that hid cross-device RSVPs from the host DB).
 */
describe("addPublicRsvp Connected Mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("persists to Supabase and does not fall back to local-only on cloud error", async () => {
    const cloudError = new Error("new row violates row-level security policy");
    const addCloud = vi.fn().mockRejectedValue(cloudError);
    const addLocal = vi.fn();

    vi.doMock("@/lib/supabase/client", () => ({
      isSupabaseConfigured: () => true,
      getSupabase: () => ({}),
    }));
    vi.doMock("@/services/demo", () => ({
      demoAuth: {},
      demoMessaging: {},
      demoPersistence: { addRsvp: addLocal },
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
      supabasePersistence: { addRsvp: addCloud },
    }));
    vi.doMock("@/services/supabase/storage", () => ({
      supabaseStorage: {},
    }));

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

  it("mirrors successful cloud RSVP locally without requiring SELECT back", async () => {
    const input = {
      id: "rsvp_2",
      eventId: "evt_2",
      guestName: "Asha",
      response: "maybe" as const,
      partySize: 2,
      createdAt: new Date().toISOString(),
    };
    const addCloud = vi.fn().mockResolvedValue(input);
    const addLocal = vi.fn().mockResolvedValue(input);

    vi.doMock("@/lib/supabase/client", () => ({
      isSupabaseConfigured: () => true,
      getSupabase: () => ({}),
    }));
    vi.doMock("@/services/demo", () => ({
      demoAuth: {},
      demoMessaging: {},
      demoPersistence: { addRsvp: addLocal },
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
      supabasePersistence: { addRsvp: addCloud },
    }));
    vi.doMock("@/services/supabase/storage", () => ({
      supabaseStorage: {},
    }));

    const { addPublicRsvp } = await import("@/services/index");
    await expect(addPublicRsvp(input)).resolves.toEqual(input);
    expect(addCloud).toHaveBeenCalledWith(input);
    expect(addLocal).toHaveBeenCalledWith(input);
  });
});
