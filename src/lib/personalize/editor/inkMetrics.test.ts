import { describe, expect, it } from "vitest";
import { measureInkBoundsInImageData } from "@/lib/personalize/editor/inkMetrics";

describe("measureInkBoundsInImageData", () => {
  it("returns tight bounds around ink, not the full selection", () => {
    const w = 40;
    const h = 30;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 250;
      data[i + 1] = 245;
      data[i + 2] = 235;
    }
    for (let y = 12; y <= 14; y += 1) {
      for (let x = 10; x <= 22; x += 1) {
        const i = (y * w + x) * 4;
        data[i] = 40;
        data[i + 1] = 20;
        data[i + 2] = 50;
      }
    }

    const bounds = measureInkBoundsInImageData(data, w, h, { x: 0, y: 0, w: 40, h: 30 }, 1);
    expect(bounds).not.toBeNull();
    expect(bounds!.w).toBeLessThan(40);
    expect(bounds!.h).toBeLessThan(30);
    expect(bounds!.x).toBeGreaterThanOrEqual(9);
    expect(bounds!.x + bounds!.w).toBeLessThanOrEqual(24);
  });

  it("returns null when selection has no ink", () => {
    const w = 10;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    const bounds = measureInkBoundsInImageData(data, w, h, { x: 0, y: 0, w: 10, h: 10 });
    expect(bounds).toBeNull();
  });
});
