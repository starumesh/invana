import { createWorker, PSM } from "tesseract.js";
import { bboxToRegion } from "@/lib/personalize/editor/region";
import type { RegionRect } from "@/lib/personalize/editor/types";
import { linesFromTesseractPage } from "@/lib/personalize/ocrExtract";

export type SuggestedRegion = {
  id: string;
  region: RegionRect;
  label: string;
  confidence: number;
};

export async function suggestTextRegions(
  sourceDataUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  onProgress?: (message: string) => void,
): Promise<SuggestedRegion[]> {
  onProgress?.("Scanning for text regions (optional)…");
  const img = await loadImage(sourceDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(`Suggestions… ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await worker.recognize(canvas);
    const lines = linesFromTesseractPage(data);
    return lines.map((line, i) => ({
      id: `suggest-${i}`,
      region: bboxToRegion(line.bbox),
      label: line.text.slice(0, 48),
      confidence: line.confidence,
    }));
  } finally {
    await worker.terminate();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for suggestions."));
    img.src = src;
  });
}
