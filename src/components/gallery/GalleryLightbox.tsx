import { useCallback, useEffect, useState } from "react";
import { downloadPhotoFromUrl } from "@/lib/downloadPhoto";
import { renderCollage } from "@/lib/collage";
import { MAX_COLLAGE_PHOTOS } from "@/lib/collageLayout";
import { downloadBlob } from "@/lib/export";
import type { GalleryPhoto } from "@/services/gallery/types";

type Props = {
  photos: GalleryPhoto[];
  initialIndex?: number;
  eventTitle?: string;
  onClose: () => void;
};

export function GalleryLightbox({ photos, initialIndex = 0, eventTitle = "", onClose }: Props) {
  const ordered = [...photos].reverse();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, ordered.length - 1)),
  );
  const [downloadingCollage, setDownloadingCollage] = useState(false);
  const [downloadingPhoto, setDownloadingPhoto] = useState(false);

  const current = ordered[index];
  const hasMultiple = ordered.length > 1;
  const canDownloadCollage = photos.length >= 2;

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? ordered.length - 1 : i - 1));
  }, [ordered.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= ordered.length - 1 ? 0 : i + 1));
  }, [ordered.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, ordered.length - 1)));
  }, [initialIndex, ordered.length]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function downloadCollage() {
    setDownloadingCollage(true);
    try {
      const blob = await renderCollage(photos.slice(0, MAX_COLLAGE_PHOTOS).map((p) => p.url));
      const filename = `${(eventTitle || "album").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-collage.jpg`;
      downloadBlob(blob, filename);
    } finally {
      setDownloadingCollage(false);
    }
  }

  async function downloadCurrentPhoto() {
    if (!current) return;
    setDownloadingPhoto(true);
    try {
      const base = current.contributorName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "photo";
      await downloadPhotoFromUrl(current.url, `invana-${base}.jpg`);
    } finally {
      setDownloadingPhoto(false);
    }
  }

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Shared photo gallery"
      className="fixed inset-0 z-[60] flex flex-col bg-ink/95 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-cream sm:px-6">
        <p className="truncate text-sm">
          <span className="font-medium text-cream">{current.contributorName}</span>
          {hasMultiple ? (
            <span className="text-cream/50">
              {" "}
              · {index + 1} of {ordered.length}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="rounded-full p-2 text-cream/80 transition hover:bg-white/10 hover:text-cream"
        >
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2 sm:px-12">
        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-ink/60 p-3 text-cream shadow-lg transition hover:bg-ink/80 sm:left-4"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-ink/60 p-3 text-cream shadow-lg transition hover:bg-ink/80 sm:right-4"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        ) : null}

        <img
          src={current.url}
          alt={`Photo shared by ${current.contributorName}`}
          className="max-h-[min(78vh,960px)] w-auto max-w-full rounded-lg object-contain shadow-lift"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => void downloadCurrentPhoto()}
          disabled={downloadingPhoto}
          className="inline-flex items-center gap-2 rounded-full border border-cream/30 bg-white/10 px-4 py-2 text-sm font-medium text-cream transition hover:bg-white/15 disabled:opacity-50"
        >
          {downloadingPhoto ? "Downloading…" : "Download photo"}
        </button>
        {canDownloadCollage ? (
          <button
            type="button"
            onClick={() => void downloadCollage()}
            disabled={downloadingCollage}
            className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-medium text-gold-light transition hover:bg-gold/25 disabled:opacity-50"
          >
            {downloadingCollage ? "Preparing collage…" : "Download collage"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
