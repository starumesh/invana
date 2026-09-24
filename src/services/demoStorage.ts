/** Demo storage: keeps files as object URLs / data URLs in the browser (no backend). */
import type { StorageProvider } from "@/services/types";

export const demoStorage: StorageProvider = {
  async uploadImage(opts) {
    const url = URL.createObjectURL(opts.file);
    return {
      path: `demo/${opts.eventId ?? "local"}/${opts.file.name}`,
      url,
      mimeType: opts.file.type || "image/jpeg",
      byteSize: opts.file.size,
    };
  },
};
