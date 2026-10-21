export function colorToHex(color: string): string {
  const c = color.trim();
  if (c.startsWith("#")) return c.length === 7 ? c : "#1c1917";
  const m = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!m) return "#1c1917";
  const hex = (n: string) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}
