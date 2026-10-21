import { shouldApplyLayerOnCanvas } from "@/lib/personalize/editor/layerApply";
import { regionToBBox } from "@/lib/personalize/editor/region";
import { countInkFringeInRect, parseCssColor, selectiveInkRemovalInRegion } from "@/lib/personalize/editor/inkRemoval";
import { measureInkBoundsInImageData } from "@/lib/personalize/editor/inkMetrics";
import { sanitizeInvitationText } from "@/lib/personalize/editor/textSanitize";
import type { EditorDocument, RegionRect, TextEditLayer, TextLayerStyle } from "@/lib/personalize/editor/types";
import { expandBbox, fontSizeForBox, isLikelyInk, sampleTextColor } from "@/lib/personalize/inpaintRegion";
import type { TextBBox } from "@/lib/personalize/types";

function loadCanvasFromDataUrl(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not prepare the editing canvas."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Could not load the source invitation."));
    img.src = dataUrl;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const hard = text.split(/\r?\n/);
  const out: string[] = [];
  for (const segment of hard) {
    const words = segment.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const next = `${line} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
  }
  return out;
}

export function estimateStyleFromRegion(
  ctx: CanvasRenderingContext2D,
  region: RegionRect,
  canvasWidth: number,
): TextLayerStyle {
  const box = expandBbox(regionToBBox(region), canvasWidth, ctx.canvas.height);
  const color = sampleTextColor(ctx, regionToBBox(region));
  const fontSize = fontSizeForBox("Sample", box);
  const cx = region.x + region.w / 2;
  let align: CanvasTextAlign = "center";
  if (cx < canvasWidth * 0.33) align = "left";
  else if (cx > canvasWidth * 0.67) align = "right";
  return {
    fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
    fontSize,
    fontWeight: 400,
    color,
    align,
    lineHeight: 1.2,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  };
}

async function ensureLayerFont(style: TextLayerStyle, text: string): Promise<void> {
  if (!document.fonts?.load) return;
  const sample = sanitizeInvitationText(text) || "Ay";
  await document.fonts.load(`${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`, sample).catch(() => undefined);
  await document.fonts.ready;
}

/** Letter ink bounds inside the user selection — not the full selection rectangle. */
export function resolveTextLineBounds(ctx: CanvasRenderingContext2D, layer: TextEditLayer): RegionRect {
  if (layer.inkBounds) return layer.inkBounds;
  try {
    const full = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    return (
      measureInkBoundsInImageData(full.data, ctx.canvas.width, ctx.canvas.height, layer.region) ?? layer.region
    );
  } catch {
    return layer.region;
  }
}

export async function drawLayerText(ctx: CanvasRenderingContext2D, layer: TextEditLayer): Promise<void> {
  const text = sanitizeInvitationText(layer.text);
  if (!layer.showText || !text) return;
  const { style } = layer;
  const line = resolveTextLineBounds(ctx, layer);
  const pad = 2;
  const maxW = Math.max(8, line.w - pad * 2);

  await ensureLayerFont(style, text);

  ctx.save();
  const vPad = Math.max(4, line.h * 0.22);
  ctx.beginPath();
  ctx.rect(line.x, line.y - vPad, line.w, line.h + vPad * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const fontSize = Math.max(10, Math.min(style.fontSize, line.h * 1.05));
  const fontSizeRounded = Math.round(fontSize * 4) / 4;
  ctx.font = `${style.fontWeight} ${fontSizeRounded}px ${style.fontFamily}`;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align;
  ctx.textBaseline = "middle";

  const lines = wrapLines(ctx, text, maxW);
  const lineH = fontSizeRounded * style.lineHeight;
  const blockH = lines.length * lineH;
  const cx = line.x + line.w / 2 + style.offsetX;
  const cy = line.y + line.h / 2 + style.offsetY;

  ctx.translate(cx, cy);
  ctx.rotate((style.rotation * Math.PI) / 180);

  let startY = -blockH / 2 + lineH / 2;
  for (const lineText of lines) {
    let x = 0;
    if (style.align === "left") x = -line.w / 2 + pad;
    else if (style.align === "right") x = line.w / 2 - pad;
    ctx.fillText(lineText, x, startY, maxW);
    startY += lineH;
  }

  ctx.restore();
}

export type CompositeOptions = {
  previewLayer?: TextEditLayer | null;
};

export async function compositeDocument(
  doc: EditorDocument,
  options: CompositeOptions = {},
): Promise<HTMLCanvasElement> {
  const canvas = await loadCanvasFromDataUrl(doc.sourceDataUrl);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not composite the invitation.");

  const layers = [...doc.layers];
  if (options.previewLayer) layers.push(options.previewLayer);

  for (const layer of layers) {
    if (!shouldApplyLayerOnCanvas(layer)) continue;
    const inkRgb = parseCssColor(layer.style.color) ?? undefined;
    const removalHint = { inkRgb };
    selectiveInkRemovalInRegion(ctx, layer.region, removalHint, layer.inkBounds);
    selectiveInkRemovalInRegion(ctx, layer.region, removalHint, layer.inkBounds);
    if (layer.showText) await drawLayerText(ctx, layer);
  }

  return canvas;
}

export function countInkInBBox(ctx: CanvasRenderingContext2D, box: TextBBox): number {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const w = Math.max(1, Math.floor(box.x1 - box.x0));
  const h = Math.max(1, Math.floor(box.y1 - box.y0));
  let count = 0;
  try {
    const data = ctx.getImageData(x0, y0, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      if (isLikelyInk(data[i], data[i + 1], data[i + 2])) count += 1;
    }
  } catch {
    return 0;
  }
  return count;
}

export async function assessRestorationQuality(
  doc: EditorDocument,
  selection: RegionRect,
  inkBounds?: RegionRect | null,
): Promise<{ ok: boolean; inkPixels: number; message?: string }> {
  const canvas = await loadCanvasFromDataUrl(doc.sourceDataUrl);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, inkPixels: 0, message: "Could not assess restoration." };

  const line =
    inkBounds ??
    measureInkBoundsInImageData(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
      selection,
    );
  if (!line) {
    return {
      ok: false,
      inkPixels: 0,
      message: "No text ink found in this box. Draw around the letters (empty space in the box is ignored).",
    };
  }

  const before = countInkFringeInRect(ctx, line);
  selectiveInkRemovalInRegion(ctx, selection, {}, inkBounds ?? line);
  selectiveInkRemovalInRegion(ctx, selection, {}, inkBounds ?? line);
  const after = countInkFringeInRect(ctx, line);
  const ratio = before > 0 ? after / before : 1;
  if (ratio > 0.08) {
    return {
      ok: false,
      inkPixels: after,
      message:
        "We couldn't clear the old letters cleanly. Include the full line in your box, or correct the selected text and try again.",
    };
  }
  return { ok: true, inkPixels: after };
}
