export type PersonalizeSourceKind = "image" | "pdf";

export type TextBBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PersonalizeFieldKey =
  | "brideName"
  | "groomName"
  | "hostNames"
  | "eventDate"
  | "eventTime"
  | "venueName"
  | "venueAddress"
  | "city"
  | "rsvpPhone"
  | "invitationMessage"
  | "blessingText"
  | "ceremonyName"
  | "auspiciousTime"
  | "dinnerTime"
  | "complimentsFrom"
  | "custom";

export type ExtractedField = {
  id: string;
  key: PersonalizeFieldKey;
  label: string;
  originalText: string;
  confidence: number;
  bbox: TextBBox;
  /** Listed in the editor (always true for OCR lines). */
  included: boolean;
  /** When true, original text is erased and replaced with `newValue` on export. */
  applyChange: boolean;
};

export type PersonalizeSession = {
  id: string;
  sourceKind: PersonalizeSourceKind;
  sourceMime: string;
  sourceFileName: string;
  /** Original bytes — never mutated. */
  originalBlob: Blob;
  previewUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  fields: ExtractedField[];
  /** Raster used for OCR + export (data URL or object URL). */
  workingCanvasDataUrl: string;
};

export type FieldReplacement = {
  fieldId: string;
  newValue: string;
};

export type GenerateResult = {
  blob: Blob;
  mimeType: string;
  extension: string;
  skippedFieldIds: string[];
  overflowFieldIds: string[];
};
