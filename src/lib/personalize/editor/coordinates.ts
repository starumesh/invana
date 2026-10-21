import type { RegionRect } from "@/lib/personalize/editor/types";

export type ViewTransform = {
  imageWidth: number;
  imageHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  /** Display size of the image element (CSS pixels). */
  displayWidth: number;
  displayHeight: number;
};

export function imageToScreen(
  ix: number,
  iy: number,
  t: ViewTransform,
): { x: number; y: number } {
  const scale = (t.displayWidth / t.imageWidth) * t.zoom;
  return {
    x: t.panX + ix * scale,
    y: t.panY + iy * scale,
  };
}

export function screenToImage(
  sx: number,
  sy: number,
  t: ViewTransform,
): { x: number; y: number } {
  const scale = (t.displayWidth / t.imageWidth) * t.zoom;
  if (scale <= 0) return { x: 0, y: 0 };
  return {
    x: (sx - t.panX) / scale,
    y: (sy - t.panY) / scale,
  };
}

/** Map a viewport click to image coords when the canvas uses native scroll + scale (no pan translate). */
export function screenToImageWithScroll(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  scrollLeft: number,
  scrollTop: number,
  imageWidth: number,
  displayWidth: number,
  zoom: number,
): { x: number; y: number } {
  const sx = clientX - viewportRect.left + scrollLeft;
  const sy = clientY - viewportRect.top + scrollTop;
  const scale = (displayWidth / imageWidth) * zoom;
  if (scale <= 0) return { x: 0, y: 0 };
  return { x: sx / scale, y: sy / scale };
}

export function regionToScreenRect(region: RegionRect, t: ViewTransform) {
  const a = imageToScreen(region.x, region.y, t);
  const b = imageToScreen(region.x + region.w, region.y + region.h, t);
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** Map image region to CSS pixels inside the unscaled image element (parent applies pan/zoom). */
export function regionToLocalDisplay(
  region: RegionRect,
  imageWidth: number,
  imageHeight: number,
  displayWidth: number,
  displayHeight: number,
) {
  const sx = displayWidth / imageWidth;
  const sy = displayHeight / imageHeight;
  return {
    left: region.x * sx,
    top: region.y * sy,
    width: region.w * sx,
    height: region.h * sy,
  };
}

export function normalizeDragRect(x0: number, y0: number, x1: number, y1: number): RegionRect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}

export function clampRegion(region: RegionRect, maxW: number, maxH: number): RegionRect {
  const x = Math.max(0, Math.min(region.x, maxW - 1));
  const y = Math.max(0, Math.min(region.y, maxH - 1));
  const w = Math.max(1, Math.min(region.w, maxW - x));
  const h = Math.max(1, Math.min(region.h, maxH - y));
  return { x, y, w, h };
}

export function regionsOverlap(a: RegionRect, b: RegionRect, minArea = 16): boolean {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const w = x1 - x0;
  const h = y1 - y0;
  return w * h >= minArea;
}
