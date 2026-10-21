import { createWorker, PSM } from "tesseract.js";
import { extractFieldsFromOcr } from "@/lib/personalize/ocrExtract";
import { defaultManualFields } from "@/lib/personalize/manualFields";
import { fileToWorkingCanvas } from "@/lib/personalize/loadSource";
import type { ExtractedField, PersonalizeSession, PersonalizeSourceKind } from "@/lib/personalize/types";
import { createId } from "@/lib/id";

export type AnalyzeProgress = (message: string) => void;

export type AnalyzeResult = {
  session: PersonalizeSession;
  /** True when OCR returned no lines — preset placement regions were added. */
  usedManualPresets: boolean;
};

function canvasForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const minEdge = 1600;
  const longest = Math.max(source.width, source.height);
  if (longest >= minEdge) return source;
  const scale = minEdge / longest;
  const out = document.createElement("canvas");
  out.width = Math.round(source.width * scale);
  out.height = Math.round(source.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

async function ocrCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: AnalyzeProgress,
): Promise<{ fields: ExtractedField[]; usedManualPresets: boolean }> {
  onProgress?.("Reading text from your invitation…");
  const ocrTarget = canvasForOcr(canvas);
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(`Reading text… ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });
    const { data } = await worker.recognize(ocrTarget);
    let fields = extractFieldsFromOcr(data, ocrTarget.width, ocrTarget.height);
    const scaleX = canvas.width / ocrTarget.width;
    const scaleY = canvas.height / ocrTarget.height;
    if (scaleX !== 1 || scaleY !== 1) {
      fields = fields.map((f) => ({
        ...f,
        bbox: {
          x0: f.bbox.x0 * scaleX,
          y0: f.bbox.y0 * scaleY,
          x1: f.bbox.x1 * scaleX,
          y1: f.bbox.y1 * scaleY,
        },
      }));
    }
    if (!fields.length) {
      fields = defaultManualFields(canvas.width, canvas.height);
      return { fields, usedManualPresets: true };
    }
    return { fields, usedManualPresets: false };
  } finally {
    await worker.terminate();
  }
}

export async function analyzeInvitationFile(
  file: File,
  kind: PersonalizeSourceKind,
  mime: string,
  onProgress?: AnalyzeProgress,
): Promise<AnalyzeResult> {
  onProgress?.("Preparing preview…");
  const { canvas, previewUrl } = await fileToWorkingCanvas(file, kind);
  const { fields, usedManualPresets } = await ocrCanvas(canvas, onProgress);
  const workingCanvasDataUrl = canvas.toDataURL("image/png");

  const session: PersonalizeSession = {
    id: createId("personalize"),
    sourceKind: kind,
    sourceMime: mime,
    sourceFileName: file.name,
    originalBlob: file,
    previewUrl,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    fields,
    workingCanvasDataUrl,
  };

  return { session, usedManualPresets };
}
