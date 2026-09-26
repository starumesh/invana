import { createId } from "@/lib/id";
import { requireSupabase } from "@/lib/supabase/client";
import { uploadImageViaEdge } from "@/services/api/mediaApi";
import { EdgeApiError } from "@/services/api/edgeClient";
import type { StorageProvider } from "@/services/types";

const BUCKET = "event-media";

/**
 * Uploads to Supabase Storage (public-read bucket). Host must be signed in.
 * Prefers Media Edge Function (MIME/size validation + metadata); falls back to
 * direct Storage upload when the function is not deployed.
 */
export const supabaseStorage: StorageProvider = {
  async uploadImage(opts) {
    try {
      const viaEdge = await uploadImageViaEdge(opts);
      if (viaEdge) return viaEdge;
    } catch (err) {
      // Validation errors from Media service should surface; missing function → direct upload.
      if (err instanceof EdgeApiError && err.status >= 400 && err.status < 500 && err.status !== 404) {
        throw err;
      }
    }

    const sb = requireSupabase();
    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError || !authData.user) {
      throw new Error("Sign in required to upload media in Connected Mode.");
    }
    const userId = authData.user.id;
    const eventId = opts.eventId ?? "shared";
    const ext = opts.file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${eventId}/${createId("media")}.${ext}`;

    const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, opts.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: opts.file.type || "image/jpeg",
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicData } = sb.storage.from(BUCKET).getPublicUrl(path);
    if (!publicData?.publicUrl) {
      throw new Error("Could not resolve a public URL for the upload.");
    }

    return {
      path,
      url: publicData.publicUrl,
      mimeType: opts.file.type || "image/jpeg",
      byteSize: opts.file.size,
    };
  },
};
