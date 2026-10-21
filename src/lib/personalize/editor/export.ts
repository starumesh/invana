import { PDFDocument } from "pdf-lib";
import { jsPDF } from "jspdf";
import type { EditorDocument } from "@/lib/personalize/editor/types";
import { compositeDocument } from "@/lib/personalize/editor/composite";
import { validateExportResult } from "@/lib/personalize/editor/validateExport";

export type ExportQuality = "high" | "medium";

export type ExportResult = {
  blob: Blob;
  mimeType: string;
  extension: string;
  validation: Awaited<ReturnType<typeof validateExportResult>>;
  rasterizedPdfPage: boolean;
};

export async function exportInvitation(
  doc: EditorDocument,
  options: { quality?: ExportQuality; jpegQuality?: number } = {},
): Promise<ExportResult> {
  const canvas = await compositeDocument(doc);
  const quality = options.quality ?? "high";
  const jpegQ = options.jpegQuality ?? (quality === "high" ? 0.92 : 0.85);

  if (doc.source.kind === "pdf" && doc.source.pdfBytes && doc.source.pdfPageIndex !== undefined) {
    const pageIndex = doc.source.pdfPageIndex;
    const pageCount = doc.source.pdfPageCount ?? 1;
    const jpegDataUrl = canvas.toDataURL("image/jpeg", jpegQ);
    const jpegBytes = dataUrlToUint8Array(jpegDataUrl);

    if (pageCount === 1) {
      const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true,
      });
      pdf.addImage(jpegDataUrl, "JPEG", 0, 0, canvas.width, canvas.height);
      const blob = pdf.output("blob");
      const validation = await validateExportResult(blob, doc, canvas.width, canvas.height, pageCount);
      return {
        blob,
        mimeType: "application/pdf",
        extension: "pdf",
        validation,
        rasterizedPdfPage: true,
      };
    }

    const pdfDoc = await PDFDocument.load(new Uint8Array(doc.source.pdfBytes));
    const pages = pdfDoc.getPages();
    const target = pages[pageIndex];
    if (!target) throw new Error("Could not locate the PDF page to export.");
    const { width, height } = target.getSize();
    const embedded = await pdfDoc.embedJpg(jpegBytes);
    target.drawImage(embedded, { x: 0, y: 0, width, height });
    const outBytes = await pdfDoc.save();
    const blob = new Blob([Uint8Array.from(outBytes)], { type: "application/pdf" });
    const validation = await validateExportResult(blob, doc, canvas.width, canvas.height, pageCount);
    return {
      blob,
      mimeType: "application/pdf",
      extension: "pdf",
      validation,
      rasterizedPdfPage: true,
    };
  }

  const outMime = doc.source.mime === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not create the export file."))),
      outMime,
      jpegQ,
    );
  });
  const validation = await validateExportResult(blob, doc, canvas.width, canvas.height, 1);
  return {
    blob,
    mimeType: outMime,
    extension: outMime === "image/png" ? "png" : "jpg",
    validation,
    rasterizedPdfPage: false,
  };
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
