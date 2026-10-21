/** Pure collage geometry. Rendering lives in `collage.ts`. */

export const COLLAGE_SIZE = 1600;
export const COLLAGE_BANNER_WIDTH = 1920;
export const COLLAGE_BANNER_HEIGHT = 1080;
export const COLLAGE_GAP = 12;
export const COLLAGE_PAD = 24;
export const MAX_COLLAGE_PHOTOS = 12;
export const MAX_ALBUM_PHOTOS = 40;

export type CollageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CoverCrop = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/**
 * Source rectangle that fills `dstW`×`dstH` without stretching (object-fit: cover).
 */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): CoverCrop {
  const safeSrcW = Math.max(1, srcW);
  const safeSrcH = Math.max(1, srcH);
  const safeDstW = Math.max(1, dstW);
  const safeDstH = Math.max(1, dstH);
  const srcAspect = safeSrcW / safeSrcH;
  const dstAspect = safeDstW / safeDstH;
  if (srcAspect > dstAspect) {
    const sw = safeSrcH * dstAspect;
    return { sx: (safeSrcW - sw) / 2, sy: 0, sw, sh: safeSrcH };
  }
  const sh = safeSrcW / dstAspect;
  return { sx: 0, sy: (safeSrcH - sh) / 2, sw: safeSrcW, sh };
}

function place(pad: number, x: number, y: number, width: number, height: number): CollageRect {
  return { x: pad + x, y: pad + y, width, height };
}

/**
 * Slot rectangles for 1–12 photos inside a square canvas.
 * Counts of 1, 2, 3, and 5 use an editorial split; the rest use a tight grid.
 */
export function collageLayout(
  count: number,
  size = COLLAGE_SIZE,
  gap = COLLAGE_GAP,
  pad = COLLAGE_PAD,
): CollageRect[] {
  const n = Math.max(0, Math.min(Math.floor(count), MAX_COLLAGE_PHOTOS));
  if (n === 0) return [];
  const inner = size - pad * 2;
  if (inner <= gap) return [];

  if (n === 1) return [place(pad, 0, 0, inner, inner)];

  if (n === 2) {
    const width = (inner - gap) / 2;
    return [place(pad, 0, 0, width, inner), place(pad, width + gap, 0, width, inner)];
  }

  if (n === 3) {
    const leftW = (inner - gap) * 0.58;
    const rightW = inner - gap - leftW;
    const height = (inner - gap) / 2;
    return [
      place(pad, 0, 0, leftW, inner),
      place(pad, leftW + gap, 0, rightW, height),
      place(pad, leftW + gap, height + gap, rightW, height),
    ];
  }

  if (n === 5) {
    const leftW = (inner - gap) * 0.5;
    const rightW = inner - gap - leftW;
    const cellW = (rightW - gap) / 2;
    const cellH = (inner - gap) / 2;
    const x0 = leftW + gap;
    return [
      place(pad, 0, 0, leftW, inner),
      place(pad, x0, 0, cellW, cellH),
      place(pad, x0 + cellW + gap, 0, cellW, cellH),
      place(pad, x0, cellH + gap, cellW, cellH),
      place(pad, x0 + cellW + gap, cellH + gap, cellW, cellH),
    ];
  }

  const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const cellW = (inner - gap * (cols - 1)) / cols;
  const cellH = (inner - gap * (rows - 1)) / rows;
  const lastRowCount = n % cols || cols;
  const rects: CollageRect[] = [];
  for (let i = 0; i < n; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    let x = col * (cellW + gap);
    if (row === rows - 1 && lastRowCount < cols) {
      const rowWidth = lastRowCount * cellW + (lastRowCount - 1) * gap;
      x = (inner - rowWidth) / 2 + col * (cellW + gap);
    }
    rects.push(place(pad, x, row * (cellH + gap), cellW, cellH));
  }
  return rects;
}

/** Wide 16:9 collage for downloads — balanced grids for common counts. */
export function collageLayoutBanner(
  count: number,
  width = COLLAGE_BANNER_WIDTH,
  height = COLLAGE_BANNER_HEIGHT,
  gap = COLLAGE_GAP,
  pad = COLLAGE_PAD,
): CollageRect[] {
  const n = Math.max(0, Math.min(Math.floor(count), MAX_COLLAGE_PHOTOS));
  if (n === 0) return [];
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  if (n === 1) return [{ x: pad, y: pad, width: innerW, height: innerH }];

  if (n === 2) {
    const cellW = (innerW - gap) / 2;
    return [
      { x: pad, y: pad, width: cellW, height: innerH },
      { x: pad + cellW + gap, y: pad, width: cellW, height: innerH },
    ];
  }

  if (n === 3) {
    const leftW = (innerW - gap) * 0.55;
    const rightW = innerW - gap - leftW;
    const cellH = (innerH - gap) / 2;
    return [
      { x: pad, y: pad, width: leftW, height: innerH },
      { x: pad + leftW + gap, y: pad, width: rightW, height: cellH },
      { x: pad + leftW + gap, y: pad + cellH + gap, width: rightW, height: cellH },
    ];
  }

  const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const cellW = (innerW - gap * (cols - 1)) / cols;
  const cellH = (innerH - gap * (rows - 1)) / rows;
  const rects: CollageRect[] = [];
  for (let i = 0; i < n; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push({
      x: pad + col * (cellW + gap),
      y: pad + row * (cellH + gap),
      width: cellW,
      height: cellH,
    });
  }
  return rects;
}
