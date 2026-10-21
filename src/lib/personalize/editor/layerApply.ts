import type { TextEditLayer } from "@/lib/personalize/editor/types";
import { sanitizeInvitationText } from "@/lib/personalize/editor/textSanitize";

/** True when the canvas should inpaint/draw this layer (otherwise source pixels stay visible). */
export function shouldApplyLayerOnCanvas(layer: TextEditLayer): boolean {
  if (!layer.showText) return true;
  const next = sanitizeInvitationText(layer.text);
  if (!next) return false;
  const orig = (layer.originalText ?? "").trim();
  if (orig && next === orig) return false;
  return true;
}
