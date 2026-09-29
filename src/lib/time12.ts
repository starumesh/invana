/** Parse "7:30 pm", "07:30PM", "19:30", "730pm", "7pm" → "HH:mm" (24h), or null. */
export function parseTimeText(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (!t) return null;
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.[0];
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "a" && h === 12) h = 0;
    if (mer === "p" && h !== 12) h += 12;
  } else if (h > 23 || (!m[2] && t.length <= 2)) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "19:30" → "07:30 PM" */
export function formatTime12(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${m[2]} ${suffix}`;
}

