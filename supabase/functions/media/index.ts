// Invana Media service — authenticated upload path + metadata.
// Deploy: `supabase functions deploy media`
// Product route: POST /v1/media/uploads
// Default policy: public-read bucket `event-media` (architecture §8 default).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions } from "../_shared/cors.ts";
import { json, readJson, requestId } from "../_shared/http.ts";
import { anonClient, requireUserId, serviceClient } from "../_shared/supabase.ts";

const BUCKET = "event-media";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type UploadBody = {
  /** Base64-encoded image bytes (data: prefix optional). */
  contentBase64: string;
  mimeType: string;
  eventId?: string;
  width?: number;
  height?: number;
  role?: string;
};

serve(async (req) => {
  const rid = requestId(req);
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405, { requestId: rid });
    }

    const authHeader = req.headers.get("Authorization");
    const userId = await requireUserId(authHeader);
    const body = await readJson<UploadBody>(req);

    const mimeType = (body.mimeType || "").trim().toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      return json(
        { error: "Unsupported MIME type. Allowed: image/jpeg, image/png, image/webp, image/gif." },
        400,
        { requestId: rid },
      );
    }

    let b64 = (body.contentBase64 || "").trim();
    if (b64.includes(",")) b64 = b64.split(",").pop() ?? b64;
    if (!b64) {
      return json({ error: "contentBase64 is required." }, 400, { requestId: rid });
    }

    let bytes: Uint8Array;
    try {
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return json({ error: "contentBase64 is not valid base64." }, 400, { requestId: rid });
    }

    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return json({ error: `Image must be between 1 byte and ${MAX_BYTES} bytes.` }, 400, {
        requestId: rid,
      });
    }

    const eventIdRaw = (body.eventId || "shared").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "shared";
    const ext =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : mimeType === "image/gif"
            ? "gif"
            : "jpg";
    const mediaId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const path = `${userId}/${eventIdRaw}/media_${mediaId}.${ext}`;

    const admin = serviceClient();
    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadErr) {
      return json({ error: uploadErr.message }, 400, { requestId: rid });
    }

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const httpsUrl = publicData?.publicUrl;
    if (!httpsUrl) {
      return json({ error: "Could not resolve a public URL for the upload." }, 500, { requestId: rid });
    }

    // Metadata SoR only when the event row exists and is owned by the caller.
    const metaId = `media_${mediaId}`;
    if (eventIdRaw !== "shared") {
      const userSb = anonClient(authHeader);
      const { data: owned } = await userSb
        .from("events")
        .select("id")
        .eq("id", eventIdRaw)
        .eq("user_id", userId)
        .maybeSingle();
      if (owned?.id) {
        const { error: metaErr } = await admin.from("event_media").insert({
          id: metaId,
          event_id: owned.id,
          user_id: userId,
          bucket: BUCKET,
          path,
          mime_type: mimeType,
          byte_size: bytes.byteLength,
          width: body.width ?? null,
          height: body.height ?? null,
          role: body.role ?? "gallery",
        });
        if (metaErr) {
          console.warn(JSON.stringify({ requestId: rid, msg: "event_media_insert_failed", error: metaErr.message }));
        }
      }
    }

    console.log(
      JSON.stringify({ requestId: rid, event: "media_upload", userId, path, bytes: bytes.byteLength }),
    );
    return json(
      {
        path,
        url: httpsUrl,
        mimeType,
        byteSize: bytes.byteLength,
        mediaId: metaId,
      },
      201,
      { requestId: rid },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHORIZED") {
      return json({ error: "Unauthorized." }, 401, { requestId: rid });
    }
    console.error(JSON.stringify({ requestId: rid, msg: "media_unhandled", error: message }));
    return json({ error: message }, 500, { requestId: rid });
  }
});
