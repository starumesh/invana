import { describe, expect, it } from "vitest";
import { assertDurableMediaForPublish, localMediaFieldKeys } from "@/lib/durableMedia";
import type { StoredEvent } from "@/types";

function eventWithFields(fields: Record<string, unknown>): StoredEvent {
  return {
    id: "evt_1",
    userId: "user_1",
    slug: "test",
    title: "Test",
    status: "published",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      schemaVersion: 1,
      kind: "invitation",
      templateId: "t1",
      fields,
      theme: "classic",
    },
  };
}

describe("durableMedia", () => {
  it("detects blob and data field URLs", () => {
    const keys = localMediaFieldKeys(
      eventWithFields({
        coverImage: "blob:https://x/1",
        photo: "data:image/png;base64,aaa",
        venue: "Grand Hall",
        remote: "https://cdn.example/a.jpg",
      }),
    );
    expect(keys.sort()).toEqual(["coverImage", "photo"]);
  });

  it("assertDurableMediaForPublish throws when local media remains", () => {
    expect(() =>
      assertDurableMediaForPublish(eventWithFields({ coverImage: "data:image/png;base64,x" })),
    ).toThrow(/Photos must upload/);
  });

  it("assertDurableMediaForPublish accepts HTTPS URLs", () => {
    expect(() =>
      assertDurableMediaForPublish(
        eventWithFields({ coverImage: "https://xyz.supabase.co/storage/v1/object/public/event-media/a.jpg" }),
      ),
    ).not.toThrow();
  });
});
