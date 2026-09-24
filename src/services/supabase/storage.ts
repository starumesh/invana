import { createId } from "@/lib/id";
import { requireSupabase } from "@/lib/supabase/client";
import type { StorageProvider } from "@/services/types";

const BUCKET = "event-media";

/**
 * Uploads to Supabase Storage. Host must be signed in.
 * Returns a signed URL (1 hour) for private bucket objects.
 */
export const supabaseStorage: StorageProvider = {
  async uploadImage(opts) {
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

    const { data: signed, error: signError } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message ?? "Could not create a signed URL for the upload.");
    }

    return {
      path,
      url: signed.signedUrl,
      mimeType: opts.file.type || "image/jpeg",
      byteSize: opts.file.size,
    };
  },
};
