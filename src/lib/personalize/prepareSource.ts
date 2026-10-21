import * as pdfjsLib from "pdfjs-dist";
import {
  PERSONALIZE_MAX_CANVAS_EDGE,
  PERSONALIZE_MAX_PDF_PAGES,
  PERSONALIZE_PDF_RENDER_SCALE,
} from "@/lib/personalize/limits";
import type { PersonalizeSourceKind } from "@/lib/personalize/editor/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export type PreparedCanvas = {
  canvas: HTMLCanvasElement;
  sourceDataUrl: string;
  width: number;
  height: number;
  scaledFromOriginal: boolean;
};

export type PdfInspection = {
  pageCount: number;
  bytes: ArrayBuffer;
};

/** PDF.js may transfer the load buffer to its worker; keep a separate copy for reuse (render, export). */
function retainPdfBytes(bytes: ArrayBuffer): ArrayBuffer {
  return bytes.slice(0);
}

function pdfLoadData(stableBytes: ArrayBuffer): Uint8Array {
  return new Uint8Array(stableBytes.slice(0));
}

async function openPdfDocument(stableBytes: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  return pdfjsLib.getDocument({ data: pdfLoadData(stableBytes) }).promise;
}

function scaleDownIfNeeded(canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; scaled: boolean } {
  const w = canvas.width;
  const h = canvas.height;
  const longest = Math.max(w, h);
  if (longest <= PERSONALIZE_MAX_CANVAS_EDGE) return { canvas, scaled: false };
  const scale = PERSONALIZE_MAX_CANVAS_EDGE / longest;
  const out = document.createElement("canvas");
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return { canvas, scaled: false };
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return { canvas: out, scaled: true };
}

export async function inspectPdfFile(file: Blob): Promise<PdfInspection> {
  const retained = retainPdfBytes(await file.arrayBuffer());
  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await openPdfDocument(retained);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/password|encrypted/i.test(msg)) {
      throw new Error("This PDF is password-protected. Remove the password and upload again.");
    }
    throw new Error("Could not read that PDF. It may be corrupted or unsupported.");
  }
  const pageCount = pdf.numPages;
  if (pageCount > PERSONALIZE_MAX_PDF_PAGES) {
    throw new Error(`PDFs can have at most ${PERSONALIZE_MAX_PDF_PAGES} pages for editing.`);
  }
  void pdf.cleanup();
  return { pageCount, bytes: retained };
}

export async function renderPdfPageToCanvas(
  bytes: ArrayBuffer,
  pageIndex: number,
  scale = PERSONALIZE_PDF_RENDER_SCALE,
): Promise<HTMLCanvasElement> {
  const stable = retainPdfBytes(bytes);
  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await openPdfDocument(stable);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/password|encrypted/i.test(msg)) {
      throw new Error("This PDF is password-protected. Remove the password and upload again.");
    }
    throw new Error("Could not render the PDF page. Try re-uploading the file or use a PNG/JPG export.");
  }
  const pageNumber = pageIndex + 1;
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    void pdf.cleanup();
    throw new Error("That PDF page does not exist.");
  }
  let page: pdfjsLib.PDFPageProxy;
  try {
    page = await pdf.getPage(pageNumber);
  } catch {
    void pdf.cleanup();
    throw new Error("Could not open that PDF page.");
  }
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    void pdf.cleanup();
    throw new Error("Could not render the PDF in this browser.");
  }
  try {
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  } catch {
    void pdf.cleanup();
    throw new Error("Could not draw the PDF page. The file may use features this browser cannot render.");
  }
  void pdf.cleanup();
  return canvas;
}

export async function imageFileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that image.");
    ctx.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

export async function prepareEditingCanvasFromImage(file: Blob): Promise<PreparedCanvas> {
  const raw = await imageFileToCanvas(file);
  const { canvas, scaled } = scaleDownIfNeeded(raw);
  const sourceDataUrl = canvas.toDataURL("image/png");
  return {
    canvas,
    sourceDataUrl,
    width: canvas.width,
    height: canvas.height,
    scaledFromOriginal: scaled,
  };
}

export async function prepareEditingCanvasFromPdfPage(
  bytes: ArrayBuffer,
  pageIndex: number,
): Promise<PreparedCanvas> {
  const raw = await renderPdfPageToCanvas(bytes, pageIndex);
  const { canvas, scaled } = scaleDownIfNeeded(raw);
  const sourceDataUrl = canvas.toDataURL("image/png");
  return {
    canvas,
    sourceDataUrl,
    width: canvas.width,
    height: canvas.height,
    scaledFromOriginal: scaled,
  };
}

export async function prepareSourceFile(
  file: File,
  kind: PersonalizeSourceKind,
  pdfPageIndex = 0,
  pdfBytes?: ArrayBuffer,
  pdfPageCount?: number,
): Promise<{
  prepared: PreparedCanvas;
  pdfBytes?: ArrayBuffer;
  pdfPageCount?: number;
  pdfPageIndex?: number;
}> {
  if (kind === "pdf") {
    const inspection = pdfBytes ? { bytes: pdfBytes, pageCount: pdfPageCount ?? 1 } : await inspectPdfFile(file);
    const prepared = await prepareEditingCanvasFromPdfPage(inspection.bytes, pdfPageIndex);
    return {
      prepared,
      pdfBytes: inspection.bytes,
      pdfPageCount: inspection.pageCount,
      pdfPageIndex,
    };
  }
  const prepared = await prepareEditingCanvasFromImage(file);
  return { prepared };
}
