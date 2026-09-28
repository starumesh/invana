/** Public Storage bucket used for invitation photos. */
export const EVENT_MEDIA_BUCKET = "event-media";

/** True when the URL only exists in this browser (not cloud storage). */
export function isBrowserLocalMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("blob:") || trimmed.startsWith("data:");
}

/**
 * Object path inside `event-media` from a public (or signed) Supabase Storage URL.
 * Returns null for non-Storage / other-bucket URLs.
 */
export function eventMediaStoragePath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || isBrowserLocalMediaUrl(trimmed)) return null;
  try {
    const pathname = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed).pathname
      : trimmed;
    const markers = [
      `/storage/v1/object/public/${EVENT_MEDIA_BUCKET}/`,
      `/storage/v1/object/sign/${EVENT_MEDIA_BUCKET}/`,
      `/storage/v1/object/authenticated/${EVENT_MEDIA_BUCKET}/`,
    ];
    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx >= 0) {
        const path = decodeURIComponent(pathname.slice(idx + marker.length).split("?")[0] ?? "");
        return path || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Collect Storage object paths referenced by image field values on an event. */
export function eventMediaPathsFromEvent(event: {
  config?: { fields?: Record<string, unknown> | null } | null;
}): string[] {
  const fields = event.config?.fields;
  if (!fields || typeof fields !== "object") return [];
  const paths = new Set<string>();
  for (const value of Object.values(fields)) {
    if (typeof value !== "string") continue;
    const path = eventMediaStoragePath(value);
    if (path) paths.add(path);
  }
  return [...paths];
}

/** Storage paths referenced by `before` but no longer referenced by `after`. */
export function unreferencedEventMediaPaths(
  before: Parameters<typeof eventMediaPathsFromEvent>[0] | null | undefined,
  after: Parameters<typeof eventMediaPathsFromEvent>[0] | null | undefined,
): string[] {
  if (!before) return [];
  const afterPaths = new Set(after ? eventMediaPathsFromEvent(after) : []);
  return eventMediaPathsFromEvent(before).filter((path) => !afterPaths.has(path));
}

/** Convert a File / Blob to a durable data URL (survives localStorage + SVG export). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image data."));
    };
    reader.onerror = () => reject(new Error("Could not read image data."));
    reader.readAsDataURL(blob);
  });
}

/** Fetch any URL (blob, data, or https) into a data URL for embedding. */
export async function urlToDataUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  const response = await fetch(trimmed);
  if (!response.ok) {
    throw new Error(`Could not load image (${response.status}).`);
  }
  return blobToDataUrl(await response.blob());
}

/** Build a File from a blob/data URL for Storage upload. */
export async function urlToImageFile(url: string, basename: string): Promise<File> {
  const trimmed = url.trim();
  const response = await fetch(trimmed);
  if (!response.ok) {
    throw new Error(`Could not read local image for upload (${response.status}).`);
  }
  const blob = await response.blob();
  const mime = blob.type || "image/jpeg";
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";
  const safe = basename.replace(/[^a-zA-Z0-9_-]+/g, "-") || "photo";
  return new File([blob], `${safe}.${ext}`, { type: mime });
}
