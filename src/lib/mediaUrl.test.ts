import { describe, expect, it } from "vitest";
import { isBrowserLocalMediaUrl } from "@/lib/mediaUrl";

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
