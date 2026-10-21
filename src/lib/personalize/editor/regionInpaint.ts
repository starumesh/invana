import type { RegionRect } from "@/lib/personalize/editor/types";
import type { TextBBox } from "@/lib/personalize/types";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Exact user selection — edits stay inside the box the user drew. */
export function regionToInpaintBox(region: RegionRect, canvasW: number, canvasH: number): TextBBox {
  return {
    x0: clamp(region.x, 0, canvasW),
    y0: clamp(region.y, 0, canvasH),
    x1: clamp(region.x + region.w, 0, canvasW),
    y1: clamp(region.y + region.h, 0, canvasH),
  };
}
