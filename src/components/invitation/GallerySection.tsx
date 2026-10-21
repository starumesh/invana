import { useEffect, useId, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useGalleryCover } from "@/components/invitation/useGalleryCover";
import { prepareImageForUpload } from "@/lib/imageOptimize";
import {
  addGalleryPhoto,
  listGallery,
  MAX_ALBUM_PHOTOS,
  removeGalleryPhoto,
} from "@/services/gallery/client";
import type { GalleryAlbum, GalleryOwnerKind, GalleryPhoto } from "@/services/gallery/types";

export type GalleryAlbumState = {
  photos: GalleryPhoto[];
  canModerate: boolean;
  loading: boolean;
  loadError: string | null;
  coverUrl: string | null;
  coverLoading: boolean;
  addPhoto: (contributorName: string, file: File) => Promise<void>;
  removePhoto: (photo: GalleryPhoto) => Promise<void>;
};

export function useGalleryAlbum(
  ownerKind: GalleryOwnerKind,
  slug: string,
  enabled = true,
): GalleryAlbumState {
  const [album, setAlbum] = useState<GalleryAlbum | null>(null);
  const [loading, setLoading] = useState(enabled && Boolean(slug));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !slug) {
      setAlbum(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listGallery(ownerKind, slug)
      .then((next) => {
        if (!cancelled) {
          setAlbum(next);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load shared photos.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerKind, slug, enabled]);

  const photos = album?.photos ?? [];
  const { coverUrl, coverLoading } = useGalleryCover(photos);

  async function addPhoto(contributorName: string, file: File) {
    const prepared = await prepareImageForUpload(file);
    const photo = await addGalleryPhoto({
      ownerKind,
      slug,
      contributorName,
      file: prepared,
    });
    setAlbum((prev) =>
      prev
        ? { ...prev, photos: [...prev.photos, photo] }
        : { photos: [photo], canModerate: false },
    );
  }

  async function removePhoto(photo: GalleryPhoto) {
    await removeGalleryPhoto(ownerKind, slug, photo);
    setAlbum((prev) => (prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photo.id) } : prev));
  }

  return {
    photos,
    canModerate: album?.canModerate ?? false,
    loading,
    loadError,
    coverUrl,
    coverLoading,
    addPhoto,
    removePhoto,
  };
}

type Props = {
  album: GalleryAlbumState;
  eventTitle?: string;
  className?: string;
  /** Where the cover appears — keeps guest copy accurate. */
  backdropLabel?: "invitation" | "event";
  /** Thumbnail index in display order (newest first). */
  onPhotoClick?: (displayIndex: number) => void;
};

type UploadState = "idle" | "compressing" | "uploading" | "error";

const STRIP_MAX = 5;
const THUMB_PX = "h-[52px] w-[52px]";

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="6" width="16" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7 6l1.1-2.1A1.2 1.2 0 0 1 9.2 3.2h1.6a1.2 1.2 0 0 1 1.1.7L13 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="11.4" r="3.1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-ink-muted transition ${open ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GallerySection({
  album,
  className,
  backdropLabel = "invitation",
  onPhotoClick,
}: Props) {
  const { photos, canModerate, loading, loadError, addPhoto, removePhoto } = album;
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [name, setName] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const nameId = `${uid}-name`;
  const fileId = `${uid}-file`;
  const headingId = `${uid}-heading`;

  const displayPhotos = [...photos].reverse();
  const full = photos.length >= MAX_ALBUM_PHOTOS;
  const busy = uploadState === "compressing" || uploadState === "uploading";
  const hasPhotos = photos.length > 0;
  const bandVisible = hasPhotos || sectionOpen;

  useEffect(() => {
    if (hasPhotos) setSectionOpen(true);
  }, [hasPhotos]);

  function openUpload() {
    setSectionOpen(true);
    setFormOpen(true);
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }

  function closeUpload() {
    setFormOpen(false);
    setUploadError("");
    setUploadState("idle");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!name.trim()) {
      setUploadError("Enter your name before choosing a photo.");
      nameRef.current?.focus();
      return;
    }
    setUploadError("");
    setUploadState("compressing");
    try {
      await addPhoto(name.trim(), file);
      setUploadState("idle");
      setFormOpen(false);
      setSectionOpen(true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload the photo. Try again.");
      setUploadState("error");
    }
  }

  async function handleDelete(photo: GalleryPhoto) {
    setDeleteError("");
    try {
      await removePhoto(photo);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not remove that photo.");
    }
  }

  const coverHint =
    photos.length >= 1
      ? "Latest photo is the cover — tap View full photo to browse and download."
      : `Photos are saved for every guest — shared on this ${backdropLabel}.`;

  return (
    <section className={className} aria-labelledby={headingId}>
      <div className="mx-auto max-w-5xl px-4 py-3 md:py-4">
        {!bandVisible ? (
          <button
            type="button"
            onClick={() => setSectionOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-white/85 px-4 py-3 text-left shadow-soft backdrop-blur-sm transition hover:border-gold/35 hover:bg-white"
            aria-expanded={false}
            aria-controls={`${uid}-band`}
          >
            <span id={headingId} className="font-serif text-sm tracking-tight text-ink">
              Share a moment
            </span>
            <span className="flex items-center gap-2 text-xs text-ink-muted">
              Add a photo
              <ChevronIcon open={false} />
            </span>
          </button>
        ) : (
          <div
            id={`${uid}-band`}
            className="rounded-xl border border-stone-200/80 bg-white/85 shadow-soft backdrop-blur-sm"
          >
            <div className="flex min-h-[72px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
              <div className="min-w-0 shrink-0">
                <h2 id={headingId} className="font-serif text-sm leading-tight tracking-tight text-ink">
                  Share a moment
                </h2>
                {hasPhotos ? (
                  <p className="text-[11px] text-ink-muted">Shared ({photos.length})</p>
                ) : (
                  <p className="hidden text-[11px] text-ink-muted sm:block">{coverHint}</p>
                )}
              </div>

              {loading ? (
                <p className="flex-1 truncate text-xs text-ink-muted">Loading…</p>
              ) : hasPhotos ? (
                <ul
                  className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  aria-label="Shared photos"
                >
                  {displayPhotos.slice(0, STRIP_MAX).map((photo, displayIndex) => (
                    <li
                      key={photo.id}
                      className={`group relative shrink-0 overflow-hidden rounded-xl border border-stone-200/80 bg-cream-dark ${THUMB_PX}`}
                    >
                      {onPhotoClick ? (
                        <button
                          type="button"
                          onClick={() => onPhotoClick(displayIndex)}
                          className="absolute inset-0 z-[1] block h-full w-full cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/50"
                          aria-label={`View photo by ${photo.contributorName}`}
                        />
                      ) : null}
                      <img
                        src={photo.url}
                        alt={`Photo shared by ${photo.contributorName}`}
                        className="h-full w-full object-cover transition group-hover:brightness-95"
                        loading="lazy"
                      />
                      {photo.canDelete || canModerate ? (
                        <button
                          type="button"
                          aria-label={`Remove photo by ${photo.contributorName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(photo);
                          }}
                          className="absolute -right-0.5 -top-0.5 z-[2] flex h-5 w-5 items-center justify-center rounded-full bg-ink/75 text-cream opacity-0 transition hover:bg-red-700 group-hover:opacity-100 focus:opacity-100"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                            <path
                              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      ) : null}
                    </li>
                  ))}
                  {displayPhotos.length > STRIP_MAX && onPhotoClick ? (
                    <li className="shrink-0">
                      <button
                        type="button"
                        onClick={() => onPhotoClick(STRIP_MAX)}
                        className={`flex ${THUMB_PX} items-center justify-center rounded-xl border border-dashed border-gold/45 bg-cream/80 text-xs font-medium text-gold-dark transition hover:border-gold hover:bg-white`}
                        aria-label={`View ${displayPhotos.length - STRIP_MAX} more photos`}
                      >
                        +{displayPhotos.length - STRIP_MAX}
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="min-w-0 flex-1 truncate text-xs text-ink-muted sm:hidden">{coverHint}</p>
              )}

              <div className="flex shrink-0 items-center gap-1.5">
                {!full ? (
                  <button
                    type="button"
                    onClick={formOpen ? closeUpload : openUpload}
                    aria-expanded={formOpen}
                    aria-controls={formOpen ? `${uid}-upload` : undefined}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-gold/40 bg-cream px-3.5 py-2 text-xs font-medium text-ink transition hover:border-gold hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40 sm:text-sm sm:px-4"
                  >
                    <CameraIcon className="text-gold-dark" />
                    Add photo
                  </button>
                ) : (
                  <span className="text-[11px] text-ink-muted">Album full</span>
                )}
                {!hasPhotos ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeUpload();
                      setSectionOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream hover:text-ink"
                    aria-label="Collapse share a moment"
                  >
                    <ChevronIcon open />
                  </button>
                ) : null}
              </div>
            </div>

            {formOpen && !full ? (
              <div
                id={`${uid}-upload`}
                className="border-t border-stone-200/70 px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={nameId} className="mb-1 block text-[11px] text-ink-muted">
                      Your name
                    </label>
                    <input
                      ref={nameRef}
                      id={nameId}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={60}
                      autoComplete="name"
                      placeholder="E.g. Priya S."
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-ink outline-none ring-gold/30 transition focus:border-gold focus:ring-4"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor={fileId}
                      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition focus-within:ring-4 focus-within:ring-gold/40 ${
                        busy ? "cursor-not-allowed bg-ink/50 text-cream" : "bg-ink text-cream hover:bg-stone-800"
                      }`}
                    >
                      {busy ? (
                        <>
                          <span
                            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream/40 border-t-cream"
                            aria-hidden
                          />
                          {uploadState === "compressing" ? "Preparing…" : "Uploading…"}
                        </>
                      ) : (
                        <>
                          <CameraIcon />
                          Choose photo
                        </>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={closeUpload}
                      className={buttonClassName("ghost", "sm", "min-h-10 px-3")}
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    id={fileId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => void handleFileChange(e)}
                  />
                </div>
                {uploadError ? (
                  <p className="mt-2 text-xs text-red-700" role="alert">
                    {uploadError}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[11px] text-ink-muted">
                  JPG, PNG or WebP · max 2 MB · {MAX_ALBUM_PHOTOS - photos.length}{" "}
                  {MAX_ALBUM_PHOTOS - photos.length === 1 ? "spot" : "spots"} left
                </p>
              </div>
            ) : null}

            {loadError ? (
              <p className="border-t border-amber-200/80 bg-amber-50/90 px-4 py-2 text-center text-xs text-amber-950" role="alert">
                {loadError}
              </p>
            ) : null}
            {deleteError ? (
              <p className="border-t border-stone-200/70 px-4 py-2 text-center text-xs text-red-700" role="alert">
                {deleteError}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
