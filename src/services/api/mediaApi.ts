import { callEdgeFunction } from "@/services/api/edgeClient";
import type { UploadedMedia } from "@/services/types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read image for upload."));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read image for upload."));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload via Media Edge Function (MIME/size validation + metadata).
 * Returns null when Edge is unavailable so callers can fall back to direct Storage.
 */
export async function uploadImageViaEdge(opts: {
  file: File;
  eventId?: string;
}): Promise<UploadedMedia | null> {
  const contentBase64 = await fileToBase64(opts.file);
  const data = await callEdgeFunction<{
    path: string;
    url: string;
    mimeType: string;
    byteSize: number;
  }>({
    path: "media",
    method: "POST",
    auth: true,
    body: {
      contentBase64,
      mimeType: opts.file.type || "image/jpeg",
      eventId: opts.eventId,
    },
  });
  if (!data?.url) return null;
  return {
    path: data.path,
    url: data.url,
    mimeType: data.mimeType,
    byteSize: data.byteSize,
  };
}
