/** Demo / guest storage: durable data URLs in the browser (no backend). */
import { prepareImageForUpload } from "@/lib/imageOptimize";
import { blobToDataUrl } from "@/lib/mediaUrl";
import type { StorageProvider } from "@/services/types";

export const demoStorage: StorageProvider = {
  async uploadImage(opts) {
    // Compress first so localStorage / Demo Mode does not bloat with multi‑MB data URLs.
    const file = await prepareImageForUpload(opts.file);
    const url = await blobToDataUrl(file);
    return {
      path: `demo/${opts.eventId ?? "local"}/${file.name}`,
      url,
      mimeType: file.type || "image/jpeg",
      byteSize: file.size,
    };
  },
  async removeImage() {
    /* browser-local data URLs — nothing to delete remotely */
  },
  async removeAllForEvent() {
    /* no-op */
  },
};
