import { describe, expect, it } from "vitest";
import { scoreFontMaskOverlap } from "@/lib/personalize/editor/extractFontStyle";

describe("scoreFontMaskOverlap", () => {
  it("scores high for identical masks", () => {
    const m = new Uint8Array([1, 1, 1, 1]);
    expect(scoreFontMaskOverlap(m, m)).toBeGreaterThan(0.95);
  });

  it("returns 0 for disjoint masks", () => {
    expect(scoreFontMaskOverlap(new Uint8Array([1, 0]), new Uint8Array([0, 1]))).toBe(0);
  });
});
