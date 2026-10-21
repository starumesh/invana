import { createId } from "@/lib/id";
import type { ExtractedField, PersonalizeFieldKey } from "@/lib/personalize/types";

const PRESETS: { key: PersonalizeFieldKey; label: string; yRatio: number; hRatio: number }[] = [
  { key: "hostNames", label: "Hosts", yRatio: 0.22, hRatio: 0.05 },
  { key: "brideName", label: "Bride / name", yRatio: 0.38, hRatio: 0.06 },
  { key: "groomName", label: "Groom / name", yRatio: 0.48, hRatio: 0.06 },
  { key: "eventDate", label: "Date", yRatio: 0.62, hRatio: 0.05 },
  { key: "venueName", label: "Venue", yRatio: 0.72, hRatio: 0.08 },
];

/** Starter regions when OCR finds nothing — user fills original + new text. */
export function defaultManualFields(width: number, height: number): ExtractedField[] {
  return PRESETS.map((p) => {
    const y0 = height * p.yRatio;
    const h = height * p.hRatio;
    return {
      id: createId("field"),
      key: p.key,
      label: p.label,
      originalText: "",
      confidence: 1,
      bbox: { x0: width * 0.12, y0, x1: width * 0.88, y1: y0 + h },
      included: true,
      applyChange: true,
    };
  });
}

export function createManualField(width: number, height: number, index: number): ExtractedField {
  const band = height * 0.06;
  const y0 = height * 0.3 + index * (band + 8);
  return {
    id: createId("field"),
    key: "custom",
    label: "Custom text",
    originalText: "",
    confidence: 1,
    bbox: { x0: width * 0.12, y0, x1: width * 0.88, y1: y0 + band },
    included: true,
    applyChange: true,
  };
}
