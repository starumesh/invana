/** Client-side image prepare: MIME check, EXIF bake, resize, compress ≤ 2 MB. */

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** Longest edge after resize — enough for 1080×1512 card slots @ 2× export. */
export const MAX_IMAGE_EDGE = 2048;
export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const QUALITY_STEPS = [0.84, 0.74, 0.64, 0.54, 0.44];
const EDGE_STEPS = [MAX_IMAGE_EDGE, 1600, 1280, 1024, 800];

export class ImageOptimizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageOptimizeError";
  }
}

/** Scale so the longest edge is ≤ maxEdge; never upscales. */
export function scaleToMaxEdge(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || maxEdge <= 0) {
    return { width: Math.max(0, width), height: Math.max(0, height) };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function normalizeMime(file: File): string {
  const raw = (file.type || "").trim().toLowerCase();
  if (raw && ALLOWED_IMAGE_MIME.has(raw)) return raw;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return raw;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older engines may not support imageOrientation option.
    try {
      return await createImageBitmap(file);
    } catch {
      throw new ImageOptimizeError("Could not read that image. Try a JPG, PNG, or WebP.");
    }
  }
}

function preferOutputMime(sourceMime: string): string {
  // Photos: JPEG is widely supported and usually smallest after canvas bake.
  // Keep PNG only when source is PNG and we still fit under the cap (tried later).
  if (sourceMime === "image/png") return "image/jpeg";
  if (sourceMime === "image/webp") return "image/webp";
  return "image/jpeg";
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function basenameWithoutExt(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return base.replace(/[^a-zA-Z0-9_-]+/g, "-") || "photo";
}

/**
 * Validate, orientation-bake, resize, and compress a photo for upload.
 * Throws ImageOptimizeError with a clear user-facing message on failure.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const mime = normalizeMime(file);
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    throw new ImageOptimizeError("Please upload a JPG, PNG, WebP, or GIF image.");
  }

  // Animated GIFs cannot be safely re-encoded via canvas — allow only if already ≤ 2 MB.
  if (mime === "image/gif") {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ImageOptimizeError(
        "GIF must be 2 MB or smaller. Convert to JPG or PNG, or use a smaller file.",
      );
    }
    return file;
  }

  // Already small and within edge budget: still re-encode once to bake EXIF orientation.
  // (Skipping bake leaves phone photos mis-cropped in SVG template slots.)

  const bitmap = await decodeBitmap(file);
  try {
    let outputMime = preferOutputMime(mime);
    let best: Blob | null = null;

    for (const maxEdge of EDGE_STEPS) {
      await yieldToMain();
      const { width, height } = scaleToMaxEdge(bitmap.width, bitmap.height, maxEdge);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        throw new ImageOptimizeError("Could not process that image in this browser.");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);

      for (const quality of QUALITY_STEPS) {
        await yieldToMain();
        let blob = await canvasToBlob(canvas, outputMime, quality);
        // WebP unsupported → fall back to JPEG.
        if (!blob && outputMime === "image/webp") {
          outputMime = "image/jpeg";
          blob = await canvasToBlob(canvas, outputMime, quality);
        }
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= MAX_UPLOAD_BYTES) {
          const name = `${basenameWithoutExt(file.name)}.${extensionForMime(outputMime)}`;
          return new File([blob], name, { type: outputMime, lastModified: Date.now() });
        }
      }
    }

    const sizeMb = ((best?.size ?? file.size) / (1024 * 1024)).toFixed(1);
    throw new ImageOptimizeError(
      `Photo must be 2 MB or smaller after optimization (got ${sizeMb} MB). Try a smaller image.`,
    );
  } finally {
    bitmap.close();
  }
}
