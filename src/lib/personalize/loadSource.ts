import {
  prepareEditingCanvasFromImage,
  prepareEditingCanvasFromPdfPage,
} from "@/lib/personalize/prepareSource";
import type { PersonalizeSourceKind } from "@/lib/personalize/types";

/** Legacy OCR helper — prefer `prepareSource` for the visual editor. */
export async function fileToWorkingCanvas(
  file: Blob,
  kind: PersonalizeSourceKind,
): Promise<{ canvas: HTMLCanvasElement; previewUrl: string }> {
  if (kind === "pdf") {
    const data = await file.arrayBuffer();
    const prepared = await prepareEditingCanvasFromPdfPage(data, 0);
    return { canvas: prepared.canvas, previewUrl: prepared.sourceDataUrl };
  }
  const prepared = await prepareEditingCanvasFromImage(file);
  return { canvas: prepared.canvas, previewUrl: prepared.sourceDataUrl };
}
