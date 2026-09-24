import { usePageMeta } from "@/seo/usePageMeta";
import type { PageMeta } from "@/seo/pageMeta";

/** Applies route-based document title and meta tags; optional per-page overrides. */
export function Seo(props: Partial<PageMeta> = {}) {
  const hasOverride = Object.keys(props).length > 0;
  usePageMeta(hasOverride ? props : null);
  return null;
}
