import type { TextBBox } from "@/lib/personalize/types";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Expand OCR box — script/decorative lines need generous padding. */
export function expandBbox(bbox: TextBBox, canvasW: number, canvasH: number): TextBBox {
  const w = bbox.x1 - bbox.x0;
  const h = bbox.y1 - bbox.y0;
  const padX = Math.max(18, Math.round(w * 0.14));
  const padY = Math.max(16, Math.round(h * 0.72));
  return {
    x0: clamp(bbox.x0 - padX, 0, canvasW),
    y0: clamp(bbox.y0 - padY, 0, canvasH),
    x1: clamp(bbox.x1 + padX, 0, canvasW),
    y1: clamp(bbox.y1 + padY, 0, canvasH),
  };
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Pixels that look like invitation ink (dark, purple, or brown/gold type). */
export function isLikelyInk(r: number, g: number, b: number): boolean {
  const l = luminance(r, g, b);
  if (l < 108) return true;
  if (b > r * 0.82 && r > 65 && g < Math.min(r, b) * 0.68 && l < 205) return true;
  if (r > 95 && g > 55 && b < g * 0.75 && l < 175) return true;
  return false;
}

/** Background fill color sampled from a ring just outside the erase rectangle. */
export function sampleBackgroundRing(ctx: CanvasRenderingContext2D, box: TextBBox): string {
  const ring = 6;
  const x0 = Math.floor(box.x0);
  const y0 = Math.floor(box.y0);
  const w = Math.max(1, Math.floor(box.x1 - box.x0));
  const h = Math.max(1, Math.floor(box.y1 - box.y0));
  const sx = Math.max(0, x0 - ring);
  const sy = Math.max(0, y0 - ring);
  const sw = Math.min(ctx.canvas.width - sx, w + ring * 2);
  const sh = Math.min(ctx.canvas.height - sy, h + ring * 2);

  let data: ImageData;
  try {
    data = ctx.getImageData(sx, sy, sw, sh);
  } catch {
    return "#faf6f0";
  }

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const innerX0 = x0 - sx;
  const innerY0 = y0 - sy;
  const innerX1 = innerX0 + w;
  const innerY1 = innerY0 + h;

  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const inside = x >= innerX0 && x < innerX1 && y >= innerY0 && y < innerY1;
      if (inside) continue;
      const i = (y * sw + x) * 4;
      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      if (isLikelyInk(r, g, b)) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }

  if (!rs.length) return "#faf6f0";
  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] ?? 255;
  };
  const r = median(rs);
  const g = median(gs);
  const b = median(bs);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Guess ink color from dark pixels inside the line box (before erase). */
export function sampleTextColor(ctx: CanvasRenderingContext2D, box: TextBBox): string {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const w = Math.max(1, Math.floor(box.x1 - box.x0));
  const h = Math.max(1, Math.floor(box.y1 - box.y0));
  try {
    const data = ctx.getImageData(x0, y0, w, h).data;
    const dark: { r: number; g: number; b: number; l: number }[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isLikelyInk(r, g, b)) continue;
      dark.push({ r, g, b, l: luminance(r, g, b) });
    }
    if (!dark.length) return "#1c1917";
    dark.sort((a, b) => a.l - b.l);
    const pick = dark[Math.floor(dark.length * 0.25)] ?? dark[0];
    return `rgb(${pick.r}, ${pick.g}, ${pick.b})`;
  } catch {
    return "#1c1917";
  }
}

function findCleanRowAbove(
  data: Uint8ClampedArray,
  canvasW: number,
  x: number,
  yStart: number,
  minRun = 6,
): number {
  let run = 0;
  for (let y = yStart; y >= 0; y -= 1) {
    const i = (y * canvasW + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isLikelyInk(r, g, b)) {
      run = 0;
      continue;
    }
    run += 1;
    if (run >= minRun) return y + minRun - 1;
  }
  return -1;
}

/** Reconstruct background using columns sampled above the text, then scrub leftover ink. */
export function inpaintTextRegion(ctx: CanvasRenderingContext2D, box: TextBBox): void {
  const canvas = ctx.canvas;
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(canvas.width, Math.ceil(box.x1));
  const y1 = Math.min(canvas.height, Math.ceil(box.y1));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 1 || h < 1) return;

  const gap = Math.max(4, Math.round(h * 0.06));
  let patched = false;

  if (y0 - gap - h >= 0) {
    ctx.drawImage(canvas, x0, y0 - gap - h, w, h, x0, y0, w, h);
    patched = true;
  } else if (y1 + gap + h <= canvas.height) {
    ctx.drawImage(canvas, x0, y1 + gap, w, h, x0, y0, w, h);
    patched = true;
  }

  if (!patched) {
    ctx.fillStyle = sampleBackgroundRing(ctx, box);
    ctx.fillRect(x0, y0, w, h);
  }

  try {
    const full = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width: canvasW } = full;

    for (let x = x0; x < x1; x += 1) {
      const refY = findCleanRowAbove(data, canvasW, x, y0 - 1);
      if (refY < 0) continue;
      for (let y = y0; y < y1; y += 1) {
        const srcY = clamp(refY - (y - y0), 0, y0 - 1);
        const si = (srcY * canvasW + x) * 4;
        const di = (y * canvasW + x) * 4;
        data[di] = data[si];
        data[di + 1] = data[si + 1];
        data[di + 2] = data[si + 2];
      }
    }

    scrubInkInPatch(data, canvasW, canvas.height, x0, y0, w, h, 12, 4);
    ctx.putImageData(full, 0, 0);
  } catch {
    ctx.fillStyle = sampleBackgroundRing(ctx, box);
    ctx.fillRect(x0, y0, w, h);
  }
}

function scrubInkInPatch(
  data: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  margin: number,
  passes: number,
): void {
  for (let pass = 0; pass < passes; pass += 1) {
    const snapshot = new Uint8ClampedArray(data);
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        const i = (y * canvasW + x) * 4;
        if (!isLikelyInk(snapshot[i], snapshot[i + 1], snapshot[i + 2])) continue;
        const donor = findBackgroundDonor(snapshot, canvasW, canvasH, x, y, margin);
        if (!donor) continue;
        data[i] = donor[0];
        data[i + 1] = donor[1];
        data[i + 2] = donor[2];
      }
    }
  }
}

function findBackgroundDonor(
  data: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  x: number,
  y: number,
  maxRadius: number,
): [number, number, number] | null {
  for (let r = 1; r <= maxRadius; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= canvasW || ny >= canvasH) continue;
        const i = (ny * canvasW + nx) * 4;
        const pr = data[i];
        const pg = data[i + 1];
        const pb = data[i + 2];
        if (!isLikelyInk(pr, pg, pb)) return [pr, pg, pb];
      }
    }
  }
  return null;
}

export function eraseTextRegion(ctx: CanvasRenderingContext2D, box: TextBBox): void {
  inpaintTextRegion(ctx, box);
}

export function fontSizeForBox(text: string, box: TextBBox): number {
  const height = box.y1 - box.y0;
  const width = box.x1 - box.x0;
  let size = Math.max(11, Math.min(height * 0.68, 96));
  const avgChar = 0.52;
  while (size > 10 && text.length * size * avgChar > width * 0.96) {
    size -= 1;
  }
  return size;
}

export function textAlignForBox(box: TextBBox, canvasWidth: number): CanvasTextAlign {
  const cx = (box.x0 + box.x1) / 2;
  if (cx < canvasWidth * 0.33) return "left";
  if (cx > canvasWidth * 0.67) return "right";
  return "center";
}

export function drawReplacementText(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: TextBBox,
  canvasWidth: number,
  fillStyle: string,
): void {
  const fontSize = fontSizeForBox(text, box);
  const align = textAlignForBox(box, canvasWidth);
  ctx.fillStyle = fillStyle;
  ctx.font = `${fontSize}px "Playfair Display", Georgia, "Times New Roman", serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;

  const cy = (box.y0 + box.y1) / 2;
  const pad = 4;
  if (align === "left") {
    ctx.fillText(text, box.x0 + pad, cy, box.x1 - box.x0 - pad * 2);
  } else if (align === "right") {
    ctx.fillText(text, box.x1 - pad, cy, box.x1 - box.x0 - pad * 2);
  } else {
    ctx.fillText(text, (box.x0 + box.x1) / 2, cy, box.x1 - box.x0);
  }
}
