import { sanitizeInvitationText } from "@/lib/personalize/editor/textSanitize";
import { createWorker, PSM } from "tesseract.js";

const MIN_OCR_EDGE = 720;

function upscaleForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const longest = Math.max(source.width, source.height);
  if (longest >= MIN_OCR_EDGE) return source;
  const scale = MIN_OCR_EDGE / longest;
  const out = document.createElement("canvas");
  out.width = Math.round(source.width * scale);
  out.height = Math.round(source.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function enhanceContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const l = 0.2126 * data.data[i] + 0.7152 * data.data[i + 1] + 0.0722 * data.data[i + 2];
    const boost = l > 180 ? 1.08 : l < 100 ? 0.92 : 1;
    data.data[i] = Math.min(255, data.data[i] * boost);
    data.data[i + 1] = Math.min(255, data.data[i + 1] * boost);
    data.data[i + 2] = Math.min(255, data.data[i + 2] * boost);
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

async function recognizeWithLang(canvas: HTMLCanvasElement, langs: string[], psm: PSM): Promise<string> {
  const worker = await createWorker(langs.join("+"), 1);
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
      preserve_interword_spaces: "1",
    });
    const { data } = await worker.recognize(canvas);
    return sanitizeInvitationText(data.text || "");
  } finally {
    await worker.terminate();
  }
}

/** Read text inside a cropped region with upscale + English/Telugu passes. */
export async function ocrInvitationRegion(crop: HTMLCanvasElement): Promise<{
  text: string;
  confidence: "high" | "low";
}> {
  const up = upscaleForOcr(crop);
  enhanceContrast(up);

  const attempts: string[] = [];
  try {
    attempts.push(await recognizeWithLang(up, ["eng", "tel"], PSM.SINGLE_LINE));
  } catch {
    /* eng+tel pack may be unavailable */
  }
  try {
    attempts.push(await recognizeWithLang(up, ["eng"], PSM.SINGLE_LINE));
  } catch {
    /* ignore */
  }
  try {
    attempts.push(await recognizeWithLang(up, ["eng"], PSM.SINGLE_BLOCK));
  } catch {
    /* ignore */
  }

  const ranked = attempts.filter(Boolean).sort((a, b) => b.length - a.length);
  const best = ranked[0] ?? "";
  const high = best.length >= 3 && /[\p{L}]{2,}/u.test(best);
  return { text: best, confidence: high ? "high" : "low" };
}
