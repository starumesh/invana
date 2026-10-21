import type { RegionRect } from "@/lib/personalize/editor/types";
import type { TextBBox } from "@/lib/personalize/types";

export function regionToBBox(region: RegionRect): TextBBox {
  return {
    x0: region.x,
    y0: region.y,
    x1: region.x + region.w,
    y1: region.y + region.h,
  };
}

export function bboxToRegion(bbox: TextBBox): RegionRect {
  return {
    x: bbox.x0,
    y: bbox.y0,
    w: bbox.x1 - bbox.x0,
    h: bbox.y1 - bbox.y0,
  };
}
