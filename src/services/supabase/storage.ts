import { createId } from "@/lib/id";
import { MAX_UPLOAD_BYTES } from "@/lib/imageOptimize";
import { EVENT_MEDIA_BUCKET, eventMediaStoragePath } from "@/lib/mediaUrl";
import { requireSupabase } from "@/lib/supabase/client";
import { uploadImageViaEdge } from "@/services/api/mediaApi";
import { EdgeApiError } from "@/services/api/edgeClient";
import type { StorageProvider } from "@/services/types";

const BUCKET = EVENT_MEDIA_BUCKET;

function extensionFor(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

async function requireAuthedUserId(): Promise<string> {
  const sb = requireSupabase();
  const { data: authData, error: authError } = await sb.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sign in required to upload media in Connected Mode.");
  }
  return authData.user.id;
}

function resolvePath(urlOrPath: string): string | null {
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("://") && !trimmed.startsWith("/")) {
    // Already a bucket-relative path like `userId/eventId/file.jpg`.
    return trimmed.replace(/^\/+/, "");
  }
  return eventMediaStoragePath(trimmed);
}

async function removePaths(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  if (!unique.length) return;
  const sb = requireSupabase();
  // Chunk — Storage remove accepts batches; keep them modest.
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { error } = await sb.storage.from(BUCKET).remove(chunk);
    if (error) {
      // Best-effort: log-worthy but do not block event delete / UI replace.
      console.warn("[storage] remove failed:", error.message, chunk);
    }
  }
}

/**
 * Uploads to Supabase Storage (public-read bucket). Host must be signed in.
 * Prefers Media Edge Function (MIME/size validation + metadata); falls back to
 * direct Storage upload when the function is not deployed. Images are compressed
 * client-side to <=2 MB before either path.
 */
export const supabaseStorage: StorageProvider = {
  async uploadImage(opts) {
    if (opts.file.size > MAX_UPLOAD_BYTES) {
      throw new Error("Image must be 2 MB or smaller. Compress or resize the photo and try again.");
    }
    const file = opts.file;

    try {
      const viaEdge = await uploadImageViaEdge({ ...opts, file });
      if (viaEdge) return viaEdge;
    } catch (err) {
      // Validation errors from Media service should surface; missing function → direct upload.
      if (err instanceof EdgeApiError && err.status >= 400 && err.status < 500 && err.status !== 404) {
        throw err;
      }
    }

    const sb = requireSupabase();
    const userId = await requireAuthedUserId();
    const eventId = opts.eventId ?? "shared";
    const ext = extensionFor(file);
    const path = `${userId}/${eventId}/${createId("media")}.${ext}`;

    const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicData } = sb.storage.from(BUCKET).getPublicUrl(path);
    if (!publicData?.publicUrl) {
      throw new Error("Could not resolve a public URL for the upload.");
    }

    return {
      path,
      url: publicData.publicUrl,
      mimeType: file.type || "image/jpeg",
      byteSize: file.size,
    };
  },

  async removeImage(urlOrPath) {
    const path = resolvePath(urlOrPath);
    if (!path) return;
    await removePaths([path]);
  },

  async removeAllForEvent(opts) {
    const sb = requireSupabase();
    const userId = await requireAuthedUserId();
    const eventId = opts.eventId.trim();
    if (!eventId) return;

    const paths = new Set<string>(opts.knownPaths ?? []);

    // Folder listing covers uploads that used `{userId}/{eventId}/…`.
    const prefix = `${userId}/${eventId}`;
    try {
      const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
      if (!error && data?.length) {
        for (const obj of data) {
          if (obj.name) paths.add(`${prefix}/${obj.name}`);
        }
      }
    } catch {
      /* list optional */
    }

    // Metadata table (Edge uploads) — cascade will clear rows after event delete,
    // but we need paths before the DB row disappears.
    try {
      const { data: meta } = await sb.from("event_media").select("path").eq("event_id", eventId);
      for (const row of meta ?? []) {
        if (typeof row.path === "string" && row.path) paths.add(row.path);
      }
    } catch {
      /* table may be missing in older projects */
    }

    await removePaths([...paths]);
  },
};
