import { describe, expect, it } from "vitest";
import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_EDGE,
  MAX_UPLOAD_BYTES,
  scaleToMaxEdge,
} from "@/lib/imageOptimize";

describe("imageOptimize constants", () => {
  it("caps uploads at 2 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(2 * 1024 * 1024);
  });

  it("allows common photo MIME types", () => {
    expect(ALLOWED_IMAGE_MIME.has("image/jpeg")).toBe(true);
    expect(ALLOWED_IMAGE_MIME.has("image/png")).toBe(true);
    expect(ALLOWED_IMAGE_MIME.has("image/webp")).toBe(true);
    expect(ALLOWED_IMAGE_MIME.has("image/gif")).toBe(true);
    expect(ALLOWED_IMAGE_MIME.has("image/svg+xml")).toBe(false);
  });

  it("uses a practical max edge for card slots", () => {
    expect(MAX_IMAGE_EDGE).toBeGreaterThanOrEqual(1600);
    expect(MAX_IMAGE_EDGE).toBeLessThanOrEqual(4096);
  });
});

describe("scaleToMaxEdge", () => {
  it("does not upscale small images", () => {
    expect(scaleToMaxEdge(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it("scales landscape so width equals max edge", () => {
    expect(scaleToMaxEdge(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it("scales portrait so height equals max edge", () => {
    expect(scaleToMaxEdge(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });
});
