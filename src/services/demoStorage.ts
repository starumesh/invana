/** Demo / guest storage: durable data URLs in the browser (no backend). */
import { blobToDataUrl } from "@/lib/mediaUrl";
import type { StorageProvider } from "@/services/types";

export const demoStorage: StorageProvider = {
  async uploadImage(opts) {
    // Prefer data URLs over blob: so photos survive localStorage, reload, and SVG→PNG/PDF export.
    const url = await blobToDataUrl(opts.file);
    return {
      path: `demo/${opts.eventId ?? "local"}/${opts.file.name}`,
      url,
      mimeType: opts.file.type || "image/jpeg",
      byteSize: opts.file.size,
    };
  },
};
