import { describe, expect, it } from "vitest";
import { COLLAGE_GAP, COLLAGE_PAD, COLLAGE_SIZE, collageLayout, coverCrop, MAX_COLLAGE_PHOTOS } from "@/lib/collageLayout";

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5 && a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5;
}

describe("collageLayout", () => {
  it("returns one slot per photo up to the cap", () => {
    expect(collageLayout(0)).toEqual([]);
    expect(collageLayout(1)).toHaveLength(1);
    expect(collageLayout(5)).toHaveLength(5);
    expect(collageLayout(12)).toHaveLength(12);
    expect(collageLayout(40)).toHaveLength(MAX_COLLAGE_PHOTOS);
  });

  it("keeps every slot inside the canvas without overlap", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 9, 12]) {
      const rects = collageLayout(count);
      rects.forEach((rect, index) => {
        expect(rect.x).toBeGreaterThanOrEqual(COLLAGE_PAD - 0.01);
        expect(rect.y).toBeGreaterThanOrEqual(COLLAGE_PAD - 0.01);
        expect(rect.x + rect.width).toBeLessThanOrEqual(COLLAGE_SIZE - COLLAGE_PAD + 0.01);
        expect(rect.y + rect.height).toBeLessThanOrEqual(COLLAGE_SIZE - COLLAGE_PAD + 0.01);
        expect(rect.width).toBeGreaterThan(COLLAGE_GAP);
        expect(rect.height).toBeGreaterThan(COLLAGE_GAP);
        for (const other of rects.slice(index + 1)) {
          expect(overlaps(rect, other)).toBe(false);
        }
      });
    }
  });
});

describe("coverCrop", () => {
  it("crops the sides of a landscape photo in a portrait slot", () => {
    const crop = coverCrop(4000, 2000, 100, 200);
    expect(crop.sy).toBe(0);
    expect(crop.sh).toBe(2000);
    expect(crop.sw).toBeCloseTo(1000);
    expect(crop.sx).toBeCloseTo(1500);
  });

  it("crops the top and bottom of a portrait photo in a landscape slot", () => {
    const crop = coverCrop(1000, 2000, 200, 100);
    expect(crop.sx).toBe(0);
    expect(crop.sw).toBe(1000);
    expect(crop.sh).toBeCloseTo(500);
    expect(crop.sy).toBeCloseTo(750);
  });
});
