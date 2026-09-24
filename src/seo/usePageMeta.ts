import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyPageMeta, metaForPath, type PageMeta } from "@/seo/pageMeta";

/**
 * Sets document title + meta/OG/Twitter tags from the current route.
 * Pass `override` for dynamic pages (e.g. public invite title once loaded).
 */
export function usePageMeta(override?: Partial<PageMeta> | null) {
  const { pathname } = useLocation();
  const title = override?.title;
  const description = override?.description;
  const keywords = override?.keywords;
  const image = override?.image;
  const type = override?.type;
  const noIndex = override?.noIndex;
  const hasOverride = override != null;

  useEffect(() => {
    const base = metaForPath(pathname);
    if (!hasOverride) {
      applyPageMeta(base);
      return;
    }
    applyPageMeta({
      ...base,
      title: title ?? base.title,
      description: description ?? base.description,
      keywords: keywords ?? base.keywords,
      image: image ?? base.image,
      type: type ?? base.type,
      noIndex: noIndex ?? base.noIndex,
    });
  }, [pathname, hasOverride, title, description, keywords, image, type, noIndex]);
}
