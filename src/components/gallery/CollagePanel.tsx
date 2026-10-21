import { useEffect, useRef, useState } from "react";
import { MAX_COLLAGE_PHOTOS } from "@/lib/collageLayout";
import { renderCollage } from "@/lib/collage";
import { downloadBlob } from "@/lib/export";
import type { GalleryPhoto } from "@/services/gallery/types";

type Props = {
  photos: GalleryPhoto[];
  eventTitle: string;
  onClose: () => void;
};

export function CollagePanel({ photos, eventTitle, onClose }: Props) {
  const capped = photos.slice(0, MAX_COLLAGE_PHOTOS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(capped.map((p) => p.id)));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const previewAbort = useRef<AbortController | null>(null);

  const orderedSelected = capped.filter((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreviewUrl(null);
    setError("");
  }

  async function generatePreview() {
    if (orderedSelected.length === 0) {
      setError("Select at least one photo.");
      return;
    }
    previewAbort.current?.abort();
    const ac = new AbortController();
    previewAbort.current = ac;
    setGenerating(true);
    setError("");
    setPreviewUrl(null);
    try {
      const blob = await renderCollage(orderedSelected.map((p) => p.url));
      if (ac.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      if (ac.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Could not generate the collage.");
    } finally {
      if (!ac.signal.aborted) setGenerating(false);
    }
  }

  async function download() {
    if (!previewUrl) {
      await generatePreview();
      return;
    }
    setDownloading(true);
    setError("");
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const filename = `${(eventTitle || "collage").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-collage.jpg`;
      downloadBlob(blob, filename);
    } catch {
      setError("Could not download the collage.");
    } finally {
      setDownloading(false);
    }
  }

  // Clean up blob URL on unmount.
  useEffect(() => {
    return () => {
      previewAbort.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    /* Modal backdrop */
    <div
      role="dialog"
      aria-label="Create collage"
      aria-modal
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 px-4 pb-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-stone-200 bg-cream shadow-lift">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/60 bg-cream-dark/40 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">Gallery</p>
            <h2 className="mt-1 font-serif text-2xl tracking-tight">Create collage</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-ink-muted transition hover:bg-stone-200/50 hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "80vh" }}>
          {/* Photo selection */}
          <div className="px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
              Select photos ({selected.size}/{Math.min(capped.length, MAX_COLLAGE_PHOTOS)} selected)
            </p>
            {capped.length === 0 && (
              <p className="mt-3 text-sm text-ink-muted">No photos in the album yet.</p>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {capped.map((photo) => {
                const isSelected = selected.has(photo.id);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => toggle(photo.id)}
                    aria-label={`${isSelected ? "Deselect" : "Select"} photo by ${photo.contributorName}`}
                    aria-pressed={isSelected}
                    className="group relative aspect-square overflow-hidden rounded-xl border-2 transition"
                    style={{ borderColor: isSelected ? "#b8956a" : "transparent" }}
                  >
                    <img
                      src={photo.url}
                      alt={`Photo by ${photo.contributorName}`}
                      className="h-full w-full object-cover transition group-hover:brightness-90"
                      loading="lazy"
                      crossOrigin="anonymous"
                    />
                    {/* Checkmark badge */}
                    <span
                      aria-hidden
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow transition"
                      style={{ background: isSelected ? "#b8956a" : "rgba(255,255,255,0.7)", color: isSelected ? "#fff" : "transparent" }}
                    >
                      ✓
                    </span>
                    {/* Contributor name */}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink/70 px-1.5 pb-1 pt-4 text-[10px] text-cream opacity-0 transition group-hover:opacity-100">
                      {photo.contributorName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="px-6 pb-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Preview</p>
              <div className="mt-2 overflow-hidden rounded-2xl border border-stone-200 shadow-soft">
                <img src={previewUrl} alt="Collage preview" className="w-full" />
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="mx-6 mt-2 text-sm text-red-700">{error}</p>}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 px-6 pb-6 pt-4">
            <button
              type="button"
              onClick={() => void generatePreview()}
              disabled={generating || orderedSelected.length === 0}
              className="inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" aria-hidden />
                  Generating…
                </>
              ) : previewUrl ? "Regenerate" : "Generate collage"}
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={() => void download()}
                disabled={downloading}
                className="inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-xl border border-gold bg-gold/10 px-5 py-2.5 text-sm font-medium text-gold-dark transition hover:bg-gold/20 disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold/40 border-t-gold-dark" aria-hidden />
                    Downloading…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M8 2v8m0 0L5 7m3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Download
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
