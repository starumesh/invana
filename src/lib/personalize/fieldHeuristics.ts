import { createId } from "@/lib/id";
import type { ExtractedField, PersonalizeFieldKey, TextBBox } from "@/lib/personalize/types";

export type OcrLine = {
  text: string;
  bbox: TextBBox;
  confidence: number;
};

const DATE_RE =
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}[/-]\d{1,2})|\d{4}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const TIME_RE = /\b(\d{1,2}\s*:\s*\d{2}|\d{1,2}\s*(?:am|pm|a\.m|p\.m))\b/i;
const PHONE_RE = /(?:\+?\d[\d\s-]{8,}\d|tel|rsvp|call)/i;
const VENUE_RE = /\b(mandapam|mandap|hall|venue|road|street|city|resort|hotel|temple|church|banquet)\b/i;
const BLESSING_RE = /\b(rastu|subhamastu|avighnamastu|shubham|om|ganesh|invocation)\b/i;
const DINNER_RE = /\bdinner\b/i;
const MUHURTHAM_RE = /\b(sumuhurtham|muhurtham|lagnam|ceremony)\b/i;
const COMPLIMENT_RE = /\b(compliments|regards|near\s*&\s*dear)\b/i;
const WITH_RE = /^\s*with\s*$/i;
const AMPERSAND_NAME = /\s&\s| and /i;

function classifyLine(text: string): { key: PersonalizeFieldKey; label: string; confidence: number } {
  const t = text.trim();
  if (!t) return { key: "custom", label: "Other text", confidence: 0.2 };
  if (BLESSING_RE.test(t)) return { key: "blessingText", label: "Blessing", confidence: 0.75 };
  if (MUHURTHAM_RE.test(t)) return { key: "ceremonyName", label: "Ceremony", confidence: 0.7 };
  if (DINNER_RE.test(t)) return { key: "dinnerTime", label: "Dinner", confidence: 0.65 };
  if (COMPLIMENT_RE.test(t)) return { key: "complimentsFrom", label: "Compliments from", confidence: 0.65 };
  if (PHONE_RE.test(t)) return { key: "rsvpPhone", label: "RSVP / phone", confidence: 0.7 };
  if (VENUE_RE.test(t)) return { key: "venueName", label: "Venue", confidence: 0.65 };
  if (DATE_RE.test(t)) return { key: "eventDate", label: "Date", confidence: 0.72 };
  if (TIME_RE.test(t)) return { key: "eventTime", label: "Time", confidence: 0.68 };
  if (/^mr\.|^mrs\.|^sri |^smt\.|^dr\./i.test(t) || /host|parents|family/i.test(t)) {
    return { key: "hostNames", label: "Hosts", confidence: 0.6 };
  }
  if (AMPERSAND_NAME.test(t) && t.length < 80) {
    return { key: "brideName", label: "Names (couple)", confidence: 0.55 };
  }
  if (WITH_RE.test(t)) return { key: "custom", label: "Divider", confidence: 0.3 };
  if (t.length > 120) return { key: "invitationMessage", label: "Message", confidence: 0.5 };
  if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(t) && t.length < 60) {
    return { key: "custom", label: "Name or title", confidence: 0.45 };
  }
  return { key: "custom", label: "Other text", confidence: 0.35 };
}

/** Merge OCR words into lines by vertical proximity. */
export function groupOcrLines(
  words: { text: string; bbox: TextBBox; confidence: number }[],
  lineThreshold = 12,
): OcrLine[] {
  const sorted = [...words].filter((w) => w.text.trim()).sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
  const lines: OcrLine[] = [];
  for (const word of sorted) {
    const last = lines[lines.length - 1];
    const cy = (word.bbox.y0 + word.bbox.y1) / 2;
    if (last && Math.abs(cy - (last.bbox.y0 + last.bbox.y1) / 2) <= lineThreshold) {
      last.text = `${last.text} ${word.text}`.replace(/\s+/g, " ").trim();
      last.bbox = {
        x0: Math.min(last.bbox.x0, word.bbox.x0),
        y0: Math.min(last.bbox.y0, word.bbox.y0),
        x1: Math.max(last.bbox.x1, word.bbox.x1),
        y1: Math.max(last.bbox.y1, word.bbox.y1),
      };
      last.confidence = (last.confidence + word.confidence) / 2;
    } else {
      lines.push({ text: word.text.trim(), bbox: { ...word.bbox }, confidence: word.confidence });
    }
  }
  return lines.filter((l) => l.text.length > 1);
}

export function linesToFields(lines: OcrLine[]): ExtractedField[] {
  return lines.map((line) => {
    const { key, label, confidence } = classifyLine(line.text);
    return {
      id: createId("field"),
      key,
      label,
      originalText: line.text,
      confidence,
      bbox: line.bbox,
      included: line.text.trim().length >= 2,
      applyChange: false,
    };
  });
}

export function sortFieldsByPosition(fields: ExtractedField[]): ExtractedField[] {
  return [...fields].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
}

/** Shrink font size until text fits bbox width (approximate). */
export function estimateFontSize(text: string, maxWidth: number, startSize = 28): number {
  const avgChar = 0.55;
  let size = startSize;
  while (size > 10 && text.length * size * avgChar > maxWidth) {
    size -= 2;
  }
  return size;
}
