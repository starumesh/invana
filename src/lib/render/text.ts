export function wrapText(text: string, maxWidth: number, fontSize: number, letterSpacing = 0): string[] {
  // Preserve author newlines (biodata Label : value rows), then soft-wrap long lines.
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const charWidth = fontSize * 0.52 + letterSpacing;
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      // Keep blank lines between sections when intentionally present.
      if (paragraph === "" && lines.length) lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length * charWidth > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export function fitFontSize(
  text: string,
  maxWidth: number,
  preferred: number,
  min = 14,
): number {
  const longest = text
    .split(/\n/)
    .map((line) => line.length)
    .reduce((a, b) => Math.max(a, b), 0);
  const width = longest * preferred * 0.52;
  if (width <= maxWidth) return preferred;
  return Math.max(min, Math.floor(preferred * (maxWidth / width)));
}
