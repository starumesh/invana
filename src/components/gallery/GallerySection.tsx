import { useRef, useState } from "react";
import { CollagePanel } from "@/components/gallery/CollagePanel";
import { prepareImageForUpload } from "@/lib/imageOptimize";
import {
  addGalleryPhoto,
  listGallery,
  MAX_ALBUM_PHOTOS,
  removeGalleryPhoto,
} from "@/services/gallery/client";
import type { GalleryAlbum, GalleryOwnerKind, GalleryPhoto } from "@/services/gallery/types";

type Props = {
  ownerKind: GalleryOwnerKind;
  slug: string;
  eventTitle: string;
  /** Pass the album loaded by the parent, or `null` to load lazily. */
  initialAlbum?: GalleryAlbum | null;
  className?: string;
};

type UploadState = "idle" | "compressing" | "uploading" | "error";

export function GallerySection({ ownerKind, slug, eventTitle, initialAlbum = null, className }: Props) {
  const [album, setAlbum] = useState<GalleryAlbum | null>(initialAlbum);
  const [loading, setLoading] = useState(initialAlbum === null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [name, setName] = useState("");
  const [showCollage, setShowCollage] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Lazy load on first render if no initialAlbum.
  const loadedRef = useRef(false);
  if (!loadedRef.current && initialAlbum === null) {
    loadedRef.current = true;
    listGallery(ownerKind, slug)
      .then((a) => { setAlbum(a); setLoading(false); })
      .catch(() => { setLoading(false); });
  }

  const photos = album?.photos ?? [];
  const canModerate = album?.canModerate ?? false;
  const full = photos.length >= MAX_ALBUM_PHOTOS;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so the same file can be chosen again after a successful upload.
    e.target.value = "";
    if (!file) return;
    if (!name.trim()) {
      setUploadError("Enter your name before choosing a photo.");
      return;
    }
    setUploadError("");
    setUploadState("compressing");
    try {
      // Pre-compress locally (prepareImageForUpload is called again in addGalleryPhoto, which is fine — idempotent).
      await prepareImageForUpload(file); // validates only — actual compress happens inside addGalleryPhoto
      setUploadState("uploading");
      const photo = await addGalleryPhoto({ ownerKind, slug, contributorName: name.trim(), file });
      setAlbum((prev) => prev
        ? { ...prev, photos: [...prev.photos, photo] }
        : { photos: [photo], canModerate: false });
      setUploadState("idle");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload the photo. Try again.");
      setUploadState("error");
    }
  }

  async function handleDelete(photo: GalleryPhoto) {
    setDeleteError("");
    try {
      await removeGalleryPhoto(ownerKind, slug, photo);
      setAlbum((prev) => prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photo.id) } : prev);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not remove that photo.");
    }
  }

  return (
    <section className={className} aria-labelledby="gallery-heading">
      {/* Heading */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">Memories</p>
          <h2 id="gallery-heading" className="mt-1 font-serif text-3xl tracking-tight">Photo album</h2>
        </div>
        {photos.length >= 2 && (
          <button
            type="button"
            onClick={() => setShowCollage(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gold/60 bg-gold/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-gold-dark transition hover:bg-gold/20"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <rect x="1" y="1" width="5.5" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8.5" y="1" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8.5" y="7" width="5.5" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Make collage
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square animate-soft-pulse rounded-2xl bg-cream-dark" />
          ))}
        </div>
      )}

      {/* Photo grid */}
      {!loading && photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-stone-200/80 shadow-soft">
              <img
                src={photo.url}
                alt={`Photo shared by ${photo.contributorName}`}
                className="h-full w-full object-cover transition group-hover:brightness-90"
                loading="lazy"
              />
              {/* Contributor overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 px-2.5 pb-2 pt-6 text-cream opacity-0 transition group-hover:opacity-100">
                <p className="truncate text-xs">{photo.contributorName}</p>
                {photo.contributorRole === "host" && (
                  <p className="text-[10px] text-gold-light">Host</p>
                )}
              </div>
              {/* Delete button */}
              {(photo.canDelete || canModerate) && (
                <button
                  type="button"
                  aria-label={`Remove photo by ${photo.contributorName}`}
                  onClick={() => void handleDelete(photo)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-cream opacity-0 transition hover:bg-red-700 group-hover:opacity-100"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && photos.length === 0 && (
        <p className="text-sm text-ink-muted">
          No photos yet. Be the first to share a memory!
        </p>
      )}

      {/* Delete error */}
      {deleteError && <p className="mt-3 text-sm text-red-700">{deleteError}</p>}

      {/* Upload form */}
      {!full && (
        <div className="mt-6 rounded-2xl border border-stone-200/70 bg-cream-dark/30 p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            Share a photo
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="gallery-contributor-name" className="mb-1 block text-xs text-ink-muted">
                Your name
              </label>
              <input
                id="gallery-contributor-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="E.g. Priya S."
                className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-gold/30 transition focus:border-gold focus:ring-4"
              />
            </div>
            <label
              htmlFor="gallery-file-input"
              className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                uploadState === "idle" || uploadState === "error"
                  ? "bg-ink text-cream hover:opacity-90"
                  : "cursor-not-allowed bg-ink/50 text-cream"
              }`}
            >
              {uploadState === "compressing" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" aria-hidden />
                  Compressing…
                </>
              ) : uploadState === "uploading" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" aria-hidden />
                  Uploading…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M8 2v8m0-8L5 5m3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Choose photo
                </>
              )}
            </label>
            <input
              id="gallery-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploadState === "compressing" || uploadState === "uploading"}
              onChange={(e) => void handleFileChange(e)}
            />
          </div>
          {uploadError && <p className="mt-2 text-sm text-red-700">{uploadError}</p>}
          <p className="mt-2 text-xs text-ink-muted">
            JPG, PNG or WebP · max 2 MB · {MAX_ALBUM_PHOTOS - photos.length} spot{MAX_ALBUM_PHOTOS - photos.length === 1 ? "" : "s"} remaining
          </p>
        </div>
      )}

      {full && (
        <p className="mt-4 text-sm text-ink-muted">
          This album is full ({MAX_ALBUM_PHOTOS} photos).
        </p>
      )}

      {/* Collage panel modal */}
      {showCollage && (
        <CollagePanel
          photos={photos}
          eventTitle={eventTitle}
          onClose={() => setShowCollage(false)}
        />
      )}
    </section>
  );
}
