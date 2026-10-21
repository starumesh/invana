import { PERSONALIZE_MAX_BYTES, PERSONALIZE_MAX_PDF_PAGES } from "@/lib/personalize/limits";
import { inspectPdfFile } from "@/lib/personalize/prepareSource";

const EXT_OK = new Set(["png", "jpg", "jpeg", "pdf"]);
const MIME_OK = new Set(["image/png", "image/jpeg", "application/pdf"]);

export type ValidUpload =
  | { ok: true; kind: "image" | "pdf"; mime: string }
  | { ok: false; message: string };

export function validatePersonalizeFileMeta(file: File): ValidUpload {
  const mime = (file.type || "").trim().toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  const mimeOk = MIME_OK.has(mime) || (mime === "" && EXT_OK.has(ext));
  if (!mimeOk) {
    return {
      ok: false,
      message: "Please upload a PNG, JPG, JPEG, or PDF invitation.",
    };
  }

  if (file.size <= 0) {
    return { ok: false, message: "That file is empty. Choose another invitation." };
  }
  if (file.size > PERSONALIZE_MAX_BYTES) {
    return {
      ok: false,
      message: `Invitation must be ${Math.round(PERSONALIZE_MAX_BYTES / (1024 * 1024))} MB or smaller.`,
    };
  }

  const kind = mime === "application/pdf" || ext === "pdf" ? "pdf" : "image";
  const resolvedMime =
    kind === "pdf"
      ? "application/pdf"
      : mime === "image/png" || ext === "png"
        ? "image/png"
        : "image/jpeg";

  return { ok: true, kind, mime: resolvedMime };
}

function matchesMagic(bytes: Uint8Array, kind: "image" | "pdf"): boolean {
  if (bytes.length < 4) return false;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  const isPdf = header.startsWith("%PDF");
  if (kind === "pdf") return isPdf;
  return isPng || isJpeg;
}

/** Validates extension/MIME plus magic bytes and PDF readability. */
export async function validatePersonalizeFile(file: File): Promise<ValidUpload> {
  const meta = validatePersonalizeFileMeta(file);
  if (!meta.ok) return meta;

  const buf = await file.slice(0, Math.min(file.size, 8192)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!matchesMagic(bytes, meta.kind)) {
    return {
      ok: false,
      message: "File content does not match a PNG, JPEG, or PDF. Check the file and try again.",
    };
  }

  if (meta.kind === "pdf") {
    try {
      const { pageCount } = await inspectPdfFile(file);
      if (pageCount > PERSONALIZE_MAX_PDF_PAGES) {
        return {
          ok: false,
          message: `PDFs can have at most ${PERSONALIZE_MAX_PDF_PAGES} pages.`,
        };
      }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Could not read that PDF.",
      };
    }
  }

  return meta;
}
