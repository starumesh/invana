type Props = {
  coverSrc: string;
  coverLoading?: boolean;
  onOpenGallery?: () => void;
  /** Dark gradient for event headers; cream for invitations. */
  variant?: "invite" | "event";
};

export function GalleryCoverLayer({ coverSrc, coverLoading, onOpenGallery, variant = "invite" }: Props) {
  const gradient =
    variant === "event"
      ? "bg-gradient-to-b from-ink/55 via-ink/70 to-ink/85"
      : "bg-gradient-to-b from-ink/50 via-cream/55 to-cream";

  return (
    <>
      <img
        src={coverSrc}
        alt=""
        data-gallery-cover
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
      />
      {coverLoading ? (
        <div className="pointer-events-none absolute inset-0 z-[1] animate-pulse bg-cream/25" aria-hidden />
      ) : null}
      {onOpenGallery ? (
        <>
          <button
            type="button"
            onClick={onOpenGallery}
            aria-label="View shared photos full screen"
            className="absolute inset-0 z-[2] block w-full cursor-pointer border-0 bg-transparent p-0"
          />
          <span className="pointer-events-none absolute bottom-6 left-1/2 z-[4] -translate-x-1/2 rounded-full border border-white/40 bg-ink/45 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-cream shadow-md backdrop-blur-sm">
            View full photo
          </span>
        </>
      ) : null}
      <div className={`pointer-events-none absolute inset-0 z-[3] ${gradient}`} aria-hidden />
    </>
  );
}
