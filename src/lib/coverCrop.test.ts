import { describe, expect, it } from "vitest";
import { coverCropRect } from "@/lib/coverCrop";

describe("coverCropRect", () => {
  it("fills a wide frame from a tall photo (crop top/bottom)", () => {
    // Frame 200×100, photo 100×200 → scale by width → 200×400, centered y = -150
    const r = coverCropRect(0, 0, 200, 100, 100, 200);
    expect(r.width).toBe(200);
    expect(r.height).toBe(400);
    expect(r.x).toBe(0);
    expect(r.y).toBe(-150);
  });

  it("fills a tall frame from a wide photo (crop sides)", () => {
    // Frame 100×200, photo 200×100 → scale by height → 400×200, centered x = -150
    const r = coverCropRect(10, 20, 100, 200, 200, 100);
    expect(r.width).toBe(400);
    expect(r.height).toBe(200);
    expect(r.x).toBe(10 - 150);
    expect(r.y).toBe(20);
  });

  it("matches frame when aspects are equal", () => {
    const r = coverCropRect(5, 5, 300, 150, 600, 300);
    expect(r).toEqual({ x: 5, y: 5, width: 300, height: 150 });
  });

  it("returns frame on invalid natural size", () => {
    expect(coverCropRect(1, 2, 3, 4, 0, 10)).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});
