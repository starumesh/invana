import { jsPDF } from "jspdf";
import {
  drawReplacementText,
  eraseTextRegion,
  expandBbox,
  fontSizeForBox,
  sampleTextColor,
} from "@/lib/personalize/inpaintRegion";
import type { ExtractedField, FieldReplacement, GenerateResult, PersonalizeSession } from "@/lib/personalize/types";

function loadCanvasFromDataUrl(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not prepare the invitation canvas."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Could not load the invitation image."));
    img.src = dataUrl;
  });
}

function shouldReplace(field: ExtractedField, newValue: string): boolean {
  if (!field.applyChange) return false;
  const next = newValue.trim();
  if (!next) return false;
  return next !== field.originalText.trim();
}

export async function generatePersonalizedInvitation(
  session: PersonalizeSession,
  fields: ExtractedField[],
  replacements: FieldReplacement[],
): Promise<GenerateResult> {
  const canvas = await loadCanvasFromDataUrl(session.workingCanvasDataUrl);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not generate your invitation.");

  const byId = new Map(replacements.map((r) => [r.fieldId, r.newValue]));
  const skippedFieldIds: string[] = [];
  const overflowFieldIds: string[] = [];

  const toApply = fields
    .map((field) => ({
      field,
      newValue: (byId.get(field.id) ?? "").trim(),
      box: expandBbox(field.bbox, canvas.width, canvas.height),
    }))
    .filter(({ field, newValue }) => shouldReplace(field, newValue));

  const inkByField = new Map<string, string>();

  // Capture ink color from original pixels, then erase all regions.
  for (const { field, box } of toApply) {
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    if (w < 8 || h < 8) {
      skippedFieldIds.push(field.id);
      continue;
    }
    inkByField.set(field.id, sampleTextColor(ctx, field.bbox));
    eraseTextRegion(ctx, box);
  }

  // Draw new text after all erasures so overlaps stay clean.
  for (const { field, newValue, box } of toApply) {
    if (skippedFieldIds.includes(field.id)) continue;
    const ink = inkByField.get(field.id) ?? "#1c1917";
    drawReplacementText(ctx, newValue, box, canvas.width, ink);

    const size = fontSizeForBox(newValue, box);
    ctx.font = `${size}px serif`;
    if (ctx.measureText(newValue).width > (box.x1 - box.x0) * 1.08) {
      overflowFieldIds.push(field.id);
    }
  }

  const isPdf = session.sourceKind === "pdf";
  if (isPdf) {
    const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation,
      unit: "px",
      format: [canvas.width, canvas.height],
      compress: true,
    });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(dataUrl, "JPEG", 0, 0, canvas.width, canvas.height);
    const blob = pdf.output("blob");
    return { blob, mimeType: "application/pdf", extension: "pdf", skippedFieldIds, overflowFieldIds };
  }

  const outMime = session.sourceMime === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not create the personalized image."))),
      outMime,
      0.92,
    );
  });
  const extension = outMime === "image/png" ? "png" : "jpg";
  return { blob, mimeType: outMime, extension, skippedFieldIds, overflowFieldIds };
}
