import type { EditorDocument } from "@/lib/personalize/editor/types";

export type ExportValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  width: number;
  height: number;
  pageCount: number;
  byteLength: number;
};

export async function validateExportResult(
  blob: Blob,
  doc: EditorDocument,
  width: number,
  height: number,
  pageCount: number,
): Promise<ExportValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!blob || blob.size <= 0) {
    errors.push("Export file is empty.");
  }

  if (width !== doc.source.width || height !== doc.source.height) {
    warnings.push("Export dimensions differ from the editing canvas (scaling may have been applied on upload).");
  }

  const expectedMime =
    doc.source.kind === "pdf"
      ? "application/pdf"
      : doc.source.mime === "image/png"
        ? "image/png"
        : "image/jpeg";
  if (blob.type && blob.type !== expectedMime && !blob.type.includes("octet-stream")) {
    warnings.push(`Unexpected MIME type ${blob.type}; expected ${expectedMime}.`);
  }

  if (doc.source.kind === "pdf" && pageCount > 1) {
    warnings.push(
      "Edited PDF pages are rasterized. Vector text and structure on the edited page may be flattened; other pages are preserved.",
    );
  }

  if (doc.layers.length === 0) {
    warnings.push("No text edits were applied — export matches the source artwork.");
  }

  for (const layer of doc.layers) {
    if (!layer.text.trim() && layer.showText) {
      warnings.push("A text layer is empty.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    width,
    height,
    pageCount,
    byteLength: blob.size,
  };
}
