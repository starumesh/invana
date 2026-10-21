import type { RegionRect } from "@/lib/personalize/editor/types";
import { isLikelyInk } from "@/lib/personalize/inpaintRegion";

export type InkRemovalHint = {
  inkRgb?: [number, number, number];
};

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDist2(r: number, g: number, b: number, tr: number, tg: number, tb: number): number {
  const dr = r - tr;
  const dg = g - tg;
  const db = b - tb;
  return dr * dr + dg * dg + db * db;
}

function median(values: number[]): number {
  if (!values.length) return 240;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 240;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function pixelAt(data: Uint8ClampedArray, canvasW: number, x: number, y: number): [number, number, number] {
  const i = (y * canvasW + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

function setPixel(data: Uint8ClampedArray, canvasW: number, x: number, y: number, rgb: [number, number, number]): void {
  const i = (y * canvasW + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
}

function estimateRegionBackground(
  data: Uint8ClampedArray,
  canvasW: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
): [number, number, number] {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const yMid0 = ry0 + Math.floor((ry1 - ry0) * 0.2);
  const yMid1 = ry0 + Math.floor((ry1 - ry0) * 0.8);
  const strip = Math.max(2, Math.floor((rx1 - rx0) * 0.06));

  for (let y = yMid0; y < yMid1; y += 1) {
    for (let x = rx0; x < rx0 + strip; x += 1) {
      const [r, g, b] = pixelAt(data, canvasW, x, y);
      if (isLikelyInk(r, g, b)) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
    for (let x = rx1 - strip; x < rx1; x += 1) {
      const [r, g, b] = pixelAt(data, canvasW, x, y);
      if (isLikelyInk(r, g, b)) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }

  if (!rs.length) {
    for (let y = ry0; y < ry1; y += 1) {
      for (let x = rx0; x < rx1; x += 1) {
        const [r, g, b] = pixelAt(data, canvasW, x, y);
        if (isLikelyInk(r, g, b)) continue;
        if (luminance(r, g, b) > 200) {
          rs.push(r);
          gs.push(g);
          bs.push(b);
        }
      }
    }
  }

  return [median(rs), median(gs), median(bs)];
}

function estimateInkColor(
  data: Uint8ClampedArray,
  canvasW: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
  fallback: [number, number, number],
): [number, number, number] {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = ry0; y < ry1; y += 1) {
    for (let x = rx0; x < rx1; x += 1) {
      const [r, g, b] = pixelAt(data, canvasW, x, y);
      if (!isLikelyInk(r, g, b)) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }
  if (!rs.length) return fallback;
  return [median(rs), median(gs), median(bs)];
}

function dilateMask(mask: Uint8Array, w: number, h: number, radius = 1): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let on = false;
      for (let dy = -radius; dy <= radius && !on; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (mask[ny * w + nx]) on = true;
        }
      }
      out[y * w + x] = on ? 1 : 0;
    }
  }
  return out;
}

function findCleanRowAbove(
  data: Uint8ClampedArray,
  canvasW: number,
  x: number,
  yStart: number,
  minRun = 5,
): number {
  let run = 0;
  for (let y = yStart; y >= 0; y -= 1) {
    const [r, g, b] = pixelAt(data, canvasW, x, y);
    if (isLikelyInk(r, g, b)) {
      run = 0;
      continue;
    }
    run += 1;
    if (run >= minRun) return y + minRun - 1;
  }
  return -1;
}

function findCleanRowBelow(
  data: Uint8ClampedArray,
  canvasW: number,
  x: number,
  yStart: number,
  canvasH: number,
  minRun = 5,
): number {
  let run = 0;
  for (let y = yStart; y < canvasH; y += 1) {
    const [r, g, b] = pixelAt(data, canvasW, x, y);
    if (isLikelyInk(r, g, b)) {
      run = 0;
      continue;
    }
    run += 1;
    if (run >= minRun) return y - minRun + 1;
  }
  return -1;
}

function maskIndex(lx: number, ly: number, rw: number): number {
  return ly * rw + lx;
}

function isNearMask(mask: Uint8Array, lx: number, ly: number, rw: number, rh: number, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = lx + dx;
      const ny = ly + dy;
      if (nx < 0 || ny < 0 || nx >= rw || ny >= rh) continue;
      if (mask[maskIndex(nx, ny, rw)]) return true;
    }
  }
  return false;
}

/** Ink core + anti-alias halos tied to the stroke — not the whole selection. */
function buildInkWorkMask(
  data: Uint8ClampedArray,
  canvasW: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
  rw: number,
  rh: number,
  ink: [number, number, number],
  bg: [number, number, number],
): Uint8Array {
  const core = new Uint8Array(rw * rh);
  for (let y = ry0; y < ry1; y += 1) {
    for (let x = rx0; x < rx1; x += 1) {
      const [r, g, b] = pixelAt(data, canvasW, x, y);
      if (isLikelyInk(r, g, b)) core[maskIndex(x - rx0, y - ry0, rw)] = 1;
    }
  }

  const bgL = luminance(bg[0], bg[1], bg[2]);
  const halo = new Uint8Array(rw * rh);
  for (let y = ry0; y < ry1; y += 1) {
    for (let x = rx0; x < rx1; x += 1) {
      const lx = x - rx0;
      const ly = y - ry0;
      if (core[maskIndex(lx, ly, rw)]) continue;
      if (!isNearMask(core, lx, ly, rw, rh, 3)) continue;
      const [r, g, b] = pixelAt(data, canvasW, x, y);
      const l = luminance(r, g, b);
      if (l >= bgL - 2) continue;
      const dInk = colorDist2(r, g, b, ink[0], ink[1], ink[2]);
      const dBg = colorDist2(r, g, b, bg[0], bg[1], bg[2]);
      if (dInk + 250 < dBg || isInkFringe(r, g, b)) halo[maskIndex(lx, ly, rw)] = 1;
    }
  }

  const merged = new Uint8Array(rw * rh);
  for (let i = 0; i < merged.length; i += 1) merged[i] = core[i] || halo[i] ? 1 : 0;
  return dilateMask(merged, rw, rh, 1);
}

function cropToInkLine(
  selection: RegionRect,
  inkBounds: RegionRect | null | undefined,
  canvasW: number,
  canvasH: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const pad = 10;
  let x0 = Math.max(0, Math.floor(selection.x));
  let y0 = Math.max(0, Math.floor(selection.y));
  let x1 = Math.min(canvasW, Math.ceil(selection.x + selection.w));
  let y1 = Math.min(canvasH, Math.ceil(selection.y + selection.h));
  if (inkBounds) {
    x0 = Math.max(x0, Math.floor(inkBounds.x - pad));
    y0 = Math.max(y0, Math.floor(inkBounds.y - pad));
    x1 = Math.min(x1, Math.ceil(inkBounds.x + inkBounds.w + pad));
    y1 = Math.min(y1, Math.ceil(inkBounds.y + inkBounds.h + pad));
  }
  return { x0, y0, x1, y1 };
}

function sampleTextureAt(
  original: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  x: number,
  y: number,
  ry0: number,
  ry1: number,
): [number, number, number] {
  const refAbove = findCleanRowAbove(original, canvasW, x, ry0 - 1);
  const refBelow = findCleanRowBelow(original, canvasW, x, ry1, canvasH);
  const useAbove = refAbove >= 0;
  const refRow = useAbove ? refAbove : refBelow;
  if (refRow < 0) return pixelAt(original, canvasW, x, y);
  const srcY = useAbove ? clamp(refRow - (y - ry0), 0, ry0 - 1) : clamp(refRow + (y - ry1 + 1), ry1, canvasH - 1);
  return pixelAt(original, canvasW, x, srcY);
}

function polishInkRemnants(
  original: Uint8ClampedArray,
  data: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
  rw: number,
  workMask: Uint8Array,
  ink: [number, number, number],
  bg: [number, number, number],
): void {
  const bgL = luminance(bg[0], bg[1], bg[2]);
  const isRemnant = (r: number, g: number, b: number): boolean => {
    if (isLikelyInk(r, g, b) || isInkFringe(r, g, b)) return true;
    const l = luminance(r, g, b);
    if (l >= bgL - 1) return false;
    const dInk = colorDist2(r, g, b, ink[0], ink[1], ink[2]);
    const dBg = colorDist2(r, g, b, bg[0], bg[1], bg[2]);
    return dInk + 120 < dBg;
  };

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (let y = ry0; y < ry1; y += 1) {
      for (let x = rx0; x < rx1; x += 1) {
        const lx = x - rx0;
        const ly = y - ry0;
        if (!workMask[maskIndex(lx, ly, rw)]) continue;
        const [r, g, b] = pixelAt(data, canvasW, x, y);
        if (!isRemnant(r, g, b)) continue;
        setPixel(data, canvasW, x, y, sampleTextureAt(original, canvasW, canvasH, x, y, ry0, ry1));
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function reconstructPaperTexture(
  original: Uint8ClampedArray,
  data: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
  rw: number,
  workMask: Uint8Array,
  bg: [number, number, number],
): void {
  for (let x = rx0; x < rx1; x += 1) {
    const refAbove = findCleanRowAbove(original, canvasW, x, ry0 - 1);
    const refBelow = findCleanRowBelow(original, canvasW, x, ry1, canvasH);
    const useAbove = refAbove >= 0;
    const refRow = useAbove ? refAbove : refBelow;
    if (refRow < 0) continue;

    for (let y = ry0; y < ry1; y += 1) {
      const lx = x - rx0;
      const ly = y - ry0;
      if (!workMask[ly * rw + lx]) continue;

      let srcY: number;
      if (useAbove) {
        srcY = clamp(refRow - (y - ry0), 0, ry0 - 1);
      } else {
        srcY = clamp(refRow + (y - ry1 + 1), ry1, canvasH - 1);
      }
      setPixel(data, canvasW, x, y, pixelAt(original, canvasW, x, srcY));
    }
  }

  // Columns with no vertical reference: copy from nearest horizontal background (outside mask).
  for (let y = ry0; y < ry1; y += 1) {
    for (let x = rx0; x < rx1; x += 1) {
      const lx = x - rx0;
      const ly = y - ry0;
      if (!workMask[ly * rw + lx]) continue;
      const [r, g, b] = pixelAt(data, canvasW, x, y);
      if (!isLikelyInk(r, g, b)) continue;
      const donor = findBackgroundDonor(original, canvasW, canvasH, x, y, ry0, ry1, bg, (pr, pg, pb) =>
        isLikelyInk(pr, pg, pb),
      );
      setPixel(data, canvasW, x, y, donor);
    }
  }
}

function findBackgroundDonor(
  data: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  x: number,
  y: number,
  ry0: number,
  ry1: number,
  bg: [number, number, number],
  isRemovable: (r: number, g: number, b: number) => boolean,
): [number, number, number] {
  for (let r = 1; r <= 28; r += 1) {
    for (const dx of [-r, r]) {
      const nx = x + dx;
      const ny = y;
      if (!inBounds(nx, ny, canvasW, canvasH)) continue;
      const [pr, pg, pb] = pixelAt(data, canvasW, nx, ny);
      if (!isRemovable(pr, pg, pb)) return [pr, pg, pb];
    }
  }
  for (let r = 1; r <= 4; r += 1) {
    for (const dy of [-r, r]) {
      for (let dx = -r; dx <= r; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, canvasW, canvasH)) continue;
        if (ny < ry0 - 1 || ny >= ry1 + 1) continue;
        const [pr, pg, pb] = pixelAt(data, canvasW, nx, ny);
        if (!isRemovable(pr, pg, pb)) return [pr, pg, pb];
      }
    }
  }
  return bg;
}

function scrubInkInMask(
  data: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
  rw: number,
  workMask: Uint8Array,
  bg: [number, number, number],
  ink: [number, number, number],
  passes: number,
): void {
  const isRemovable = (r: number, g: number, b: number): boolean => {
    if (!isLikelyInk(r, g, b)) return false;
    const dInk = colorDist2(r, g, b, ink[0], ink[1], ink[2]);
    const dBg = colorDist2(r, g, b, bg[0], bg[1], bg[2]);
    return dInk + 200 < dBg;
  };

  for (let pass = 0; pass < passes; pass += 1) {
    const snap = new Uint8ClampedArray(data);
    let changed = false;
    for (let y = ry0; y < ry1; y += 1) {
      for (let x = rx0; x < rx1; x += 1) {
        const lx = x - rx0;
        const ly = y - ry0;
        if (!workMask[ly * rw + lx]) continue;
        const [r, g, b] = pixelAt(snap, canvasW, x, y);
        if (!isRemovable(r, g, b)) continue;
        const donor = findBackgroundDonor(snap, canvasW, canvasH, x, y, ry0, ry1, bg, isRemovable);
        setPixel(data, canvasW, x, y, donor);
        changed = true;
      }
    }
    if (!changed) break;
  }
}

/** Light halos / anti-aliased strokes that are not full ink. */
export function isInkFringe(r: number, g: number, b: number): boolean {
  if (isLikelyInk(r, g, b)) return true;
  const l = luminance(r, g, b);
  if (l < 190 && b > r * 0.72 && r > 50) return true;
  if (l < 180 && r > 85 && g > 45 && b < g * 0.85) return true;
  return false;
}

export function parseCssColor(color: string): [number, number, number] | null {
  const c = color.trim();
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = hex[1];
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  const rgb = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/**
 * Erase only text ink pixels found inside `selection`. The selection box is a locator;
 * background and empty space in the box are never repainted.
 */
export function selectiveInkRemovalInRegion(
  ctx: CanvasRenderingContext2D,
  selection: RegionRect,
  hint: InkRemovalHint = {},
  inkBounds?: RegionRect | null,
): void {
  const canvas = ctx.canvas;
  const crop = cropToInkLine(selection, inkBounds, canvas.width, canvas.height);
  const rx0 = crop.x0;
  const ry0 = crop.y0;
  const rx1 = crop.x1;
  const ry1 = crop.y1;
  const rw = rx1 - rx0;
  const rh = ry1 - ry0;
  if (rw < 1 || rh < 1) return;

  let full: ImageData;
  try {
    full = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return;
  }

  const { data, width: canvasW } = full;
  const original = new Uint8ClampedArray(data);
  const bg = estimateRegionBackground(original, canvasW, rx0, ry0, rx1, ry1);
  const inkFallback = hint.inkRgb ?? [80, 40, 100];
  const ink = estimateInkColor(original, canvasW, rx0, ry0, rx1, ry1, inkFallback);

  const workMask = buildInkWorkMask(original, canvasW, rx0, ry0, rx1, ry1, rw, rh, ink, bg);
  if (!workMask.some((v) => v)) return;

  reconstructPaperTexture(original, data, canvasW, canvas.height, rx0, ry0, rx1, ry1, rw, workMask, bg);
  scrubInkInMask(data, canvasW, canvas.height, rx0, ry0, rx1, ry1, rw, workMask, bg, ink, 5);
  polishInkRemnants(original, data, canvasW, canvas.height, rx0, ry0, rx1, ry1, rw, workMask, ink, bg);

  ctx.putImageData(full, 0, 0);
}

export function countInkFringeInRect(ctx: CanvasRenderingContext2D, rect: RegionRect): number {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const w = Math.max(1, Math.ceil(rect.w));
  const h = Math.max(1, Math.ceil(rect.h));
  let count = 0;
  try {
    const data = ctx.getImageData(x0, y0, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      if (isInkFringe(data[i], data[i + 1], data[i + 2])) count += 1;
    }
  } catch {
    return 0;
  }
  return count;
}

/** @deprecated Prefer countInkFringeInRect on ink bounds only. */
export function countInkInRegion(ctx: CanvasRenderingContext2D, region: RegionRect): number {
  return countInkFringeInRect(ctx, region);
}
