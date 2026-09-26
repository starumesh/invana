/** True when the URL only exists in this browser (not cloud storage). */
export function isBrowserLocalMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("blob:") || trimmed.startsWith("data:");
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
