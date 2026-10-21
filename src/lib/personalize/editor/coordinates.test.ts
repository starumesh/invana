import { describe, expect, it } from "vitest";
import {
  clampRegion,
  normalizeDragRect,
  regionToLocalDisplay,
  screenToImage,
  type ViewTransform,
} from "@/lib/personalize/editor/coordinates";

describe("screenToImage", () => {
  const t: ViewTransform = {
    imageWidth: 1000,
    imageHeight: 2000,
    zoom: 2,
    panX: 10,
    panY: 20,
    displayWidth: 500,
    displayHeight: 1000,
  };

  it("maps viewport coords to image space", () => {
    const p = screenToImage(10, 20, t);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(0, 5);
  });
});

describe("region helpers", () => {
  it("normalizes drag rects", () => {
    expect(normalizeDragRect(10, 20, 5, 8)).toEqual({ x: 5, y: 8, w: 5, h: 12 });
  });

  it("clamps to canvas", () => {
    expect(clampRegion({ x: -5, y: 0, w: 200, h: 50 }, 100, 100)).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  it("maps to local display", () => {
    const r = regionToLocalDisplay({ x: 100, y: 200, w: 50, h: 25 }, 1000, 2000, 500, 1000);
    expect(r).toEqual({ left: 50, top: 100, width: 25, height: 12.5 });
  });
});
