import { describe, expect, it } from "vitest";
import { expandBbox, isLikelyInk } from "@/lib/personalize/inpaintRegion";

describe("isLikelyInk", () => {
  it("treats dark pixels as ink", () => {
    expect(isLikelyInk(30, 20, 40)).toBe(true);
  });

  it("treats cream background as not ink", () => {
    expect(isLikelyInk(250, 245, 235)).toBe(false);
  });

  it("treats purple invitation script as ink", () => {
    expect(isLikelyInk(120, 45, 140)).toBe(true);
  });
});

describe("expandBbox", () => {
  it("adds generous vertical padding for script lines", () => {
    const box = expandBbox({ x0: 100, y0: 200, x1: 400, y1: 240 }, 800, 1200);
    expect(box.y0).toBeLessThan(200);
    expect(box.y1).toBeGreaterThan(240);
    expect(box.y1 - box.y0).toBeGreaterThan(40 + 32);
  });
});
