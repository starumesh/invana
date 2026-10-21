/** Strip OCR noise and characters that render as tofu in most fonts. */
export function sanitizeInvitationText(raw: string): string {
  let t = raw
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[|\\{}<>^~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Drop lines that are mostly punctuation / single noise glyphs.
  if (t.length <= 2 && !/[\p{L}\p{N}]/u.test(t)) return "";
  if (/^[\p{P}\p{S}\d]+$/u.test(t)) return "";
  return t;
}

export function hasIndicScript(text: string): boolean {
  return /[\u0C00-\u0C7F\u0900-\u097F]/u.test(text);
}

export function hasLatinLetters(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

export function hasScriptText(text: string): boolean {
  return /[\p{L}]/u.test(text);
}
