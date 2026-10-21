export type PersonalizeSourceKind = "image" | "pdf";

export type RegionRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TextLayerStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: CanvasTextAlign;
  lineHeight: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
};

export type TextEditLayer = {
  id: string;
  /** User-drawn box — locates the line for OCR/font matching only. */
  region: RegionRect;
  /** Tight bounds of letter ink; only these pixels are erased and redrawn. */
  inkBounds?: RegionRect;
  /** Text read from the invitation in this region (read-only reference for the user). */
  originalText: string;
  /** Replacement wording — only this is drawn when it differs from `originalText`. */
  text: string;
  style: TextLayerStyle;
  /** When false, region is restored to source on composite (remove-text only). */
  showText: boolean;
};

export type EditorSourceAsset = {
  kind: PersonalizeSourceKind;
  mime: string;
  fileName: string;
  originalBlob: Blob;
  width: number;
  height: number;
  pdfPageCount?: number;
  pdfPageIndex?: number;
  pdfBytes?: ArrayBuffer;
};

export type EditorDocument = {
  id: string;
  source: EditorSourceAsset;
  /** Immutable raster baseline (PNG data URL at working resolution). */
  sourceDataUrl: string;
  layers: TextEditLayer[];
};

export type EditorViewState = {
  zoom: number;
  panX: number;
  panY: number;
};

export const DEFAULT_LAYER_STYLE: TextLayerStyle = {
  fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
  fontSize: 28,
  fontWeight: 400,
  color: "#1c1917",
  align: "center",
  lineHeight: 1.2,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
};

export { FONT_SUGGESTIONS } from "@/lib/personalize/editor/fontCandidates";
