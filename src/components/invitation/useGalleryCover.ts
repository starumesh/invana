import type { GalleryPhoto } from "@/services/gallery/types";

export type GalleryCoverState = {
  coverUrl: string | null;
  coverLoading: boolean;
};

/**
 * Hero cover uses the **latest shared photo** at full resolution (object-cover).
 * Collages are generated only for optional download — not as the blurred hero backdrop.
 */
export function useGalleryCover(photos: GalleryPhoto[]): GalleryCoverState {
  if (photos.length === 0) {
    return { coverUrl: null, coverLoading: false };
  }
  const latest = photos[photos.length - 1];
  return { coverUrl: latest?.url ?? null, coverLoading: false };
}
