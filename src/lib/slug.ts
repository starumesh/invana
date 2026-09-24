const STOP = new Set(["and", "the", "of", "a", "an", "to"]);

export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function suggestSlug(parts: string[]): string {
  const words = parts
    .join(" ")
    .split(/\s+/)
    .filter((word) => word && !STOP.has(word.toLowerCase()));
  const slug = normalizeSlug(words.join(" "));
  return slug || "invitation";
}

export function isSlugAvailable(slug: string, taken: string[], excludeSlug?: string): boolean {
  const normalized = normalizeSlug(slug);
  if (!normalized) return false;
  if (excludeSlug && normalizeSlug(excludeSlug) === normalized) return true;
  return !taken.includes(normalized);
}

/** Build a slug that is unique among `taken` (optionally allowing one existing slug). */
export function uniqueSlug(parts: string[], taken: string[], excludeSlug?: string): string {
  const base = suggestSlug(parts);
  if (isSlugAvailable(base, taken, excludeSlug)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base.slice(0, 54)}-${n}`;
    if (isSlugAvailable(candidate, taken, excludeSlug)) return candidate;
  }
  return `${base.slice(0, 48)}-${Date.now().toString(36)}`;
}
