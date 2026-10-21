import { linesToFields, type OcrLine } from "@/lib/personalize/fieldHeuristics";
import type { ExtractedField } from "@/lib/personalize/types";

type Bbox = { x0: number; y0: number; x1: number; y1: number };

type TesseractPage = {
  text: string;
  blocks: Array<{
    paragraphs: Array<{
      lines: Array<{
        text: string;
        confidence: number;
        bbox: Bbox;
        words?: Array<{ text: string; confidence: number; bbox: Bbox }>;
      }>;
    }>;
  }> | null;
};

function normConfidence(c: number): number {
  if (c > 1) return c / 100;
  return c;
}

/** Walk Tesseract.js v7 `Page.blocks` tree into lines with bboxes. */
export function linesFromTesseractPage(page: TesseractPage): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const text = (line.text || "").replace(/\s+/g, " ").trim();
        if (text.length < 2) continue;
        let bbox = line.bbox;
        for (const word of line.words ?? []) {
          const wt = (word.text || "").trim();
          if (!wt) continue;
          bbox = {
            x0: Math.min(bbox.x0, word.bbox.x0),
            y0: Math.min(bbox.y0, word.bbox.y0),
            x1: Math.max(bbox.x1, word.bbox.x1),
            y1: Math.max(bbox.y1, word.bbox.y1),
          };
        }
        lines.push({
          text,
          bbox,
          confidence: normConfidence(line.confidence ?? 50),
        });
      }
    }
  }
  return lines;
}

/** When layout JSON is empty but plain `text` exists, assign vertical bands. */
export function linesFromPlainText(text: string, width: number, height: number): OcrLine[] {
  const rows = text
    .split(/\r?\n/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 2);
  if (!rows.length) return [];
  const padY = height * 0.08;
  const usable = height - padY * 2;
  const band = usable / rows.length;
  return rows.map((row, i) => ({
    text: row,
    confidence: 0.45,
    bbox: {
      x0: width * 0.08,
      y0: padY + i * band,
      x1: width * 0.92,
      y1: padY + (i + 1) * band - 4,
    },
  }));
}

export function extractFieldsFromOcr(
  page: TesseractPage,
  canvasWidth: number,
  canvasHeight: number,
): ExtractedField[] {
  let lines = linesFromTesseractPage(page);
  if (!lines.length) {
    lines = linesFromPlainText(page.text || "", canvasWidth, canvasHeight);
  }
  return linesToFields(lines);
}
