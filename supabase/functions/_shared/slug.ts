/** Slug normalization — keep in sync with src/lib/slug.ts normalizeSlug. */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function slugKey(slug: string): string {
  try {
    return normalizeSlug(decodeURIComponent(slug));
  } catch {
    return normalizeSlug(slug);
  }
}
