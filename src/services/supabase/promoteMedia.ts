import { prepareImageForUpload } from "@/lib/imageOptimize";
import { isBrowserLocalMediaUrl, urlToImageFile } from "@/lib/mediaUrl";
import { supabaseStorage } from "@/services/supabase/storage";
import type { StoredEvent } from "@/types";

/**
 * Upload browser-local image field values (blob:/data:) to Supabase Storage
 * and replace them with public URLs so saves / claims / downloads stay durable.
 */
export async function promoteLocalMediaInEvent(event: StoredEvent): Promise<StoredEvent> {
  const fields = event.config?.fields;
  if (!fields || typeof fields !== "object") return event;

  const entries = Object.entries(fields);
  const localKeys = entries.filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && isBrowserLocalMediaUrl(entry[1]),
  );
  if (!localKeys.length) return event;

  const nextFields: Record<string, unknown> = { ...fields };
  await Promise.all(
    localKeys.map(async ([key, url]) => {
      const file = await urlToImageFile(url, key);
      const prepared = await prepareImageForUpload(file);
      const uploaded = await supabaseStorage.uploadImage({ file: prepared, eventId: event.id });
      nextFields[key] = uploaded.url;
      if (url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }
    }),
  );

  return {
    ...event,
    config: {
      ...event.config,
      fields: nextFields,
    },
  };
}
