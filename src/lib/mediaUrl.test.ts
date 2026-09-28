import { describe, expect, it } from "vitest";
import {
  eventMediaPathsFromEvent,
  eventMediaStoragePath,
  isBrowserLocalMediaUrl,
  unreferencedEventMediaPaths,
} from "@/lib/mediaUrl";

describe("isBrowserLocalMediaUrl", () => {
  it("detects blob and data URLs", () => {
    expect(isBrowserLocalMediaUrl("blob:https://invana.stream/abc")).toBe(true);
    expect(isBrowserLocalMediaUrl("data:image/png;base64,aaa")).toBe(true);
  });

  it("rejects cloud / absolute https URLs", () => {
    expect(isBrowserLocalMediaUrl("https://xyz.supabase.co/storage/v1/object/public/event-media/a.jpg")).toBe(
      false,
    );
    expect(isBrowserLocalMediaUrl("/local/path.jpg")).toBe(false);
    expect(isBrowserLocalMediaUrl("")).toBe(false);
  });
});

describe("eventMediaStoragePath", () => {
  it("extracts path from public Storage URLs", () => {
    expect(
      eventMediaStoragePath(
        "https://xyz.supabase.co/storage/v1/object/public/event-media/uid/evt/media_1.jpg",
      ),
    ).toBe("uid/evt/media_1.jpg");
  });

  it("ignores query strings and local URLs", () => {
    expect(
      eventMediaStoragePath(
        "https://xyz.supabase.co/storage/v1/object/public/event-media/a/b.png?token=1",
      ),
    ).toBe("a/b.png");
    expect(eventMediaStoragePath("data:image/png;base64,aaa")).toBe(null);
    expect(eventMediaStoragePath("https://cdn.example/photo.jpg")).toBe(null);
  });
});

describe("eventMediaPathsFromEvent", () => {
  it("collects unique Storage paths from fields", () => {
    const paths = eventMediaPathsFromEvent({
      config: {
        fields: {
          cover:
            "https://xyz.supabase.co/storage/v1/object/public/event-media/u1/e1/a.jpg",
          other: "not-a-url",
          gallery:
            "https://xyz.supabase.co/storage/v1/object/public/event-media/u1/e1/a.jpg",
        },
      },
    });
    expect(paths).toEqual(["u1/e1/a.jpg"]);
  });

  it("finds only paths no longer referenced after an edit", () => {
    const storageUrl = (name: string) =>
      `https://xyz.supabase.co/storage/v1/object/public/event-media/u1/e1/${name}`;
    const before = {
      config: {
        fields: {
          cover: storageUrl("old.jpg"),
          retained: storageUrl("keep.jpg"),
        },
      },
    };
    const after = {
      config: {
        fields: {
          cover: storageUrl("new.jpg"),
          retained: storageUrl("keep.jpg"),
        },
      },
    };

    expect(unreferencedEventMediaPaths(before, after)).toEqual(["u1/e1/old.jpg"]);
    expect(unreferencedEventMediaPaths(null, after)).toEqual([]);
  });
});
