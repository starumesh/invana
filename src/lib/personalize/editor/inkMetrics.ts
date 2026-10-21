import type { RegionRect } from "@/lib/personalize/editor/types";
import { isLikelyInk } from "@/lib/personalize/inpaintRegion";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export type InkMetrics = {
  inkTop: number;
  inkBottom: number;
  capHeight: number;
  inkPixels: number;
  /** Estimated CSS font size matching cap height in the selection. */
  estimatedFontSize: number;
  /** Vertical offset from region center to ink center (region-local px). */
  centerOffsetY: number;
};

export function buildInkMaskFromImage(data: Uint8ClampedArray): Uint8Array {
  const mask = new Uint8Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    mask[p] = isLikelyInk(data[i], data[i + 1], data[i + 2]) ? 1 : 0;
  }
  return mask;
}

/** Cap height and vertical placement from ink pixels inside the crop. */
export function inkMetricsFromMask(inkMask: Uint8Array, w: number, h: number): InkMetrics {
  let minY = h;
  let maxY = 0;
  let inkPixels = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!inkMask[y * w + x]) continue;
      inkPixels += 1;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (inkPixels === 0 || maxY < minY) {
    const fallback = Math.max(12, h * 0.62);
    return {
      inkTop: 0,
      inkBottom: h - 1,
      capHeight: h,
      inkPixels: 0,
      estimatedFontSize: fallback,
      centerOffsetY: 0,
    };
  }
  const capHeight = maxY - minY + 1;
  const estimatedFontSize = Math.max(10, Math.min(120, Math.round(capHeight * 0.97)));
  const inkCenter = minY + capHeight / 2;
  const regionCenter = h / 2;
  return {
    inkTop: minY,
    inkBottom: maxY,
    capHeight,
    inkPixels,
    estimatedFontSize,
    centerOffsetY: inkCenter - regionCenter,
  };
}

/** Smallest rectangle covering ink pixels inside the user selection (not the whole box). */
export function measureInkBoundsInImageData(
  data: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  selection: RegionRect,
  aaPad = 2,
): RegionRect | null {
  const x0 = Math.max(0, Math.floor(selection.x));
  const y0 = Math.max(0, Math.floor(selection.y));
  const x1 = Math.min(canvasW, Math.ceil(selection.x + selection.w));
  const y1 = Math.min(canvasH, Math.ceil(selection.y + selection.h));
  let minX = x1;
  let minY = y1;
  let maxX = x0;
  let maxY = y0;
  let found = false;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * canvasW + x) * 4;
      if (!isLikelyInk(data[i], data[i + 1], data[i + 2])) continue;
      found = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!found) return null;

  const px = clamp(minX - aaPad, 0, canvasW - 1);
  const py = clamp(minY - aaPad, 0, canvasH - 1);
  const px2 = clamp(maxX + aaPad + 1, 0, canvasW);
  const py2 = clamp(maxY + aaPad + 1, 0, canvasH);
  return { x: px, y: py, w: Math.max(1, px2 - px), h: Math.max(1, py2 - py) };
}

export async function measureInkBoundsFromSource(
  sourceDataUrl: string,
  selection: RegionRect,
): Promise<RegionRect | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const full = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(measureInkBoundsInImageData(full.data, canvas.width, canvas.height, selection));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = sourceDataUrl;
  });
}
