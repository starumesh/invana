import { regionToBBox } from "@/lib/personalize/editor/region";
import type { RegionRect, TextLayerStyle } from "@/lib/personalize/editor/types";
import { FONT_MATCH_CANDIDATES } from "@/lib/personalize/editor/fontCandidates";
import { ocrInvitationRegion } from "@/lib/personalize/editor/regionOcr";
import { hasIndicScript, hasLatinLetters, sanitizeInvitationText } from "@/lib/personalize/editor/textSanitize";
import { buildInkMaskFromImage, inkMetricsFromMask } from "@/lib/personalize/editor/inkMetrics";
import { sampleTextColor } from "@/lib/personalize/inpaintRegion";

export type FontMatchSuggestion = {
  id: string;
  label: string;
  fontFamily: string;
  score: number;
};

export type FontExtractionResult = {
  detectedText: string;
  ocrConfidence: "high" | "low";
  style: TextLayerStyle;
  suggestions: FontMatchSuggestion[];
  approximate: true;
  note: string;
  /** Cap height measured from ink in the selection (px). */
  measuredCapHeight: number;
  detectedFontSize: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for font analysis."));
    img.src = src;
  });
}

function estimateBoldness(mask: Uint8Array, w: number, h: number): number {
  let ink = 0;
  for (let i = 0; i < mask.length; i += 1) ink += mask[i];
  const density = ink / (w * h);
  if (density > 0.22) return 700;
  if (density > 0.14) return 600;
  return 400;
}

async function ensureFontsLoaded(samples: string[]): Promise<void> {
  if (!document.fonts?.load) return;
  const probes = ["32px serif", ...FONT_MATCH_CANDIDATES.map((c) => `32px ${c.fontFamily}`)];
  await Promise.all(
    probes.map((spec) => document.fonts.load(spec, samples.join(" ") || "Invitation Ay").catch(() => undefined)),
  );
  await document.fonts.ready;
}

function renderTextMask(
  w: number,
  h: number,
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  align: CanvasTextAlign,
): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8Array(w * h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  const sample = text.trim() || "Ay";
  const pad = 4;
  const cx = w / 2;
  const cy = h / 2;
  if (align === "left") ctx.fillText(sample, pad, cy, w - pad * 2);
  else if (align === "right") ctx.fillText(sample, w - pad, cy, w - pad * 2);
  else ctx.fillText(sample, cx, cy, w - pad * 2);
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    mask[p] = data[i] < 128 ? 1 : 0;
  }
  return mask;
}

/** Recall-heavy overlap — rendered glyphs should cover original ink shape. */
export function scoreFontMaskOverlap(original: Uint8Array, rendered: Uint8Array): number {
  let ink = 0;
  let hit = 0;
  let extra = 0;
  for (let i = 0; i < original.length; i += 1) {
    const a = original[i];
    const b = rendered[i];
    if (a) {
      ink += 1;
      if (b) hit += 1;
    }
    if (!a && b) extra += 1;
  }
  if (ink === 0) return 0;
  const recall = hit / ink;
  const precision = hit / (hit + extra + 1);
  return recall * 0.82 + precision * 0.18;
}

function pickCandidatesForText(text: string) {
  if (hasIndicScript(text)) {
    return FONT_MATCH_CANDIDATES.filter((c) =>
      ["noto-serif-telugu", "noto-sans-telugu", "georgia", "times", "playfair", "cormorant"].includes(c.id),
    );
  }
  if (hasLatinLetters(text)) {
    return FONT_MATCH_CANDIDATES.filter((c) => c.id !== "noto-sans-telugu");
  }
  return [...FONT_MATCH_CANDIDATES];
}

function rankFontCandidates(
  inkMask: Uint8Array,
  w: number,
  h: number,
  text: string,
  preferredWeight: number,
  align: CanvasTextAlign,
  sizeHint: number,
): { suggestions: FontMatchSuggestion[]; bestWeight: number; bestSize: number; bestFamily: string } {
  const weights = [400, 500, 600, 700];
  const candidates = pickCandidatesForText(text);
  const hint = Math.max(10, Math.min(120, Math.round(sizeHint)));
  const minSize = Math.max(10, hint - 8);
  const maxSize = Math.min(120, hint + 8, h * 0.98);
  const scores: {
    id: string;
    label: string;
    fontFamily: string;
    score: number;
    weight: number;
    size: number;
  }[] = [];

  for (const c of candidates) {
    let best = 0;
    let bestWeight = preferredWeight;
    let bestSize = minSize;
    for (let size = minSize; size <= maxSize; size += 1) {
      for (const weight of weights) {
        const rendered = renderTextMask(w, h, text, c.fontFamily, size, weight, align);
        const s = scoreFontMaskOverlap(inkMask, rendered);
        if (s > best) {
          best = s;
          bestWeight = weight;
          bestSize = size;
        }
      }
    }
    scores.push({
      id: c.id,
      label: c.label,
      fontFamily: c.fontFamily,
      score: Math.round(best * 100),
      weight: bestWeight,
      size: bestSize,
    });
  }

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  return {
    suggestions: scores.map(({ id, label, fontFamily, score }) => ({ id, label, fontFamily, score })),
    bestWeight: top?.weight ?? preferredWeight,
    bestSize: top?.size ?? minSize,
    bestFamily: top?.fontFamily ?? FONT_MATCH_CANDIDATES[0].fontFamily,
  };
}

export async function extractFontStyleFromRegion(
  sourceDataUrl: string,
  region: RegionRect,
  canvasWidth: number,
  canvasHeight: number,
  onProgress?: (message: string) => void,
  knownText?: string,
): Promise<FontExtractionResult> {
  onProgress?.("Reading text in selection…");
  const img = await loadImage(sourceDataUrl);
  const full = document.createElement("canvas");
  full.width = canvasWidth;
  full.height = canvasHeight;
  const fctx = full.getContext("2d");
  if (!fctx) throw new Error("Could not analyze font.");
  fctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

  const x = Math.max(0, Math.floor(region.x));
  const y = Math.max(0, Math.floor(region.y));
  const w = Math.max(1, Math.min(Math.ceil(region.w), canvasWidth - x));
  const h = Math.max(1, Math.min(Math.ceil(region.h), canvasHeight - y));

  const crop = document.createElement("canvas");
  crop.width = w;
  crop.height = h;
  const cctx = crop.getContext("2d");
  if (!cctx) throw new Error("Could not analyze font.");
  cctx.drawImage(full, x, y, w, h, 0, 0, w, h);

  let detectedText = sanitizeInvitationText(knownText ?? "");
  let ocrConfidence: "high" | "low" = knownText ? "high" : "low";
  if (!detectedText) {
    const ocr = await ocrInvitationRegion(crop);
    detectedText = ocr.text;
    ocrConfidence = ocr.confidence;
  }

  const imageData = cctx.getImageData(0, 0, w, h);
  const inkMask = buildInkMaskFromImage(imageData.data);
  const metrics = inkMetricsFromMask(inkMask, w, h);
  const fontWeight = estimateBoldness(inkMask, w, h);
  const color = sampleTextColor(fctx, regionToBBox(region));

  const cx = region.x + region.w / 2;
  let align: CanvasTextAlign = "center";
  if (cx < canvasWidth * 0.33) align = "left";
  else if (cx > canvasWidth * 0.67) align = "right";

  const matchText =
    detectedText.length >= 2
      ? detectedText
      : hasIndicScript(detectedText)
        ? "శ్రీ"
        : "Invitation";

  onProgress?.("Matching font and size…");
  await ensureFontsLoaded([matchText, detectedText]);
  const ranked = rankFontCandidates(inkMask, w, h, matchText, fontWeight, align, metrics.estimatedFontSize);

  const detectedFontSize = Math.round(ranked.bestSize || metrics.estimatedFontSize);

  const style: TextLayerStyle = {
    fontFamily: ranked.bestFamily,
    fontSize: detectedFontSize,
    fontWeight: ranked.bestWeight,
    color,
    align,
    lineHeight: 1.12,
    rotation: 0,
    offsetX: 0,
    offsetY: metrics.centerOffsetY,
  };

  const note =
    ocrConfidence === "low"
      ? "Correct the selected line if needed, then Re-detect font. Size is measured from ink height in your box."
      : `Size ${detectedFontSize}px is measured from your selection (cap height ≈ ${metrics.capHeight}px). Font is best-match, not exact.`;

  return {
    detectedText,
    ocrConfidence,
    style,
    suggestions: ranked.suggestions,
    approximate: true,
    note,
    measuredCapHeight: metrics.capHeight,
    detectedFontSize,
  };
}
