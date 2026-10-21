// Invana Gallery service — guest and host photo albums on invitation/event sites.
// Routes:
//   GET  /gallery?ownerKind=invitation|event&slug=<slug>   — list photos
//   POST /gallery                                           — upload photo
//   DELETE /gallery                                         — remove photo
//
// All uploads go into the `event-media` Storage bucket under path:
//   gallery/{ownerKind}/{slug}/{mediaId}.ext

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions } from "../_shared/cors.ts";
import { json, readJson, requestId } from "../_shared/http.ts";
import { anonClient, requireUserId, serviceClient } from "../_shared/supabase.ts";
import { assertRateLimit } from "../_shared/rateLimit.ts";

const BUCKET = "event-media";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_ALBUM_PHOTOS = 40;
const CONTRIBUTOR_MAX_LEN = 60;

type Photo = {
  id: string;
  url: string;
  contributorName: string;
  contributorRole: "host" | "guest";
  createdAt: string;
};

type PhotoRow = {
  id: string;
  url: string;
  contributor_name: string;
  contributor_role: "host" | "guest";
  created_at: string;
};

function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    url: row.url,
    contributorName: row.contributor_name,
    contributorRole: row.contributor_role,
    createdAt: row.created_at,
  };
}

function mediaId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

function deleteToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

function sanitizeSlug(raw: string): string {
  return (raw ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}

serve(async (req) => {
  const rid = requestId(req);
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const url = new URL(req.url);
    const admin = serviceClient();

    // ------------------------------------------------------------------ GET
    if (req.method === "GET") {
      const ownerKind = (url.searchParams.get("ownerKind") ?? "").toLowerCase();
      const slug = sanitizeSlug(url.searchParams.get("slug") ?? "");
      if (!["invitation", "event"].includes(ownerKind) || !slug) {
        return json({ error: "ownerKind and slug are required." }, 400, { requestId: rid });
      }

      // Rate limit by IP
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const rate = await assertRateLimit(admin, { key: `gallery:list:${ip}`, limit: 60, windowSeconds: 60 });
      if (!rate.allowed) return json({ error: "Rate limit exceeded. Try again shortly." }, 429, { requestId: rid });

      const { data: rows, error: listErr } = await admin
        .from("gallery_photos")
        .select("id, url, contributor_name, contributor_role, created_at")
        .eq("owner_kind", ownerKind)
        .eq("owner_slug", slug)
        .order("created_at", { ascending: true });

      if (listErr) {
        console.error(JSON.stringify({ requestId: rid, msg: "gallery_list_failed", error: listErr.message }));
        return json({ error: "Could not load the album." }, 500, { requestId: rid });
      }

      // Check if the caller is the host so the client can show moderation controls.
      let canModerate = false;
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        try {
          const userId = await requireUserId(authHeader);
          if (ownerKind === "invitation") {
            const { data: ev } = await anonClient(authHeader)
              .from("events")
              .select("id")
              .eq("slug", slug)
              .eq("user_id", userId)
              .maybeSingle();
            canModerate = Boolean(ev?.id);
          } else {
            const { data: ev } = await admin
              .from("em_events")
              .select("id")
              .eq("slug", slug)
              .eq("created_by", userId)
              .maybeSingle();
            canModerate = Boolean(ev?.id);
          }
        } catch {
          // Unauthenticated — canModerate stays false.
        }
      }

      return json(
        { photos: (rows ?? []).map(toPhoto), canModerate },
        200,
        { requestId: rid },
      );
    }

    // ----------------------------------------------------------------- POST
    if (req.method === "POST") {
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const rate = await assertRateLimit(admin, { key: `gallery:upload:${ip}`, limit: 10, windowSeconds: 3600 });
      if (!rate.allowed) {
        return json({ error: "Upload limit reached. You can share up to 10 photos per hour." }, 429, { requestId: rid });
      }

      type UploadBody = {
        ownerKind: string;
        slug: string;
        contributorName: string;
        contentBase64: string;
        mimeType: string;
      };
      const body = await readJson<UploadBody>(req);
      const ownerKind = (body.ownerKind ?? "").toLowerCase();
      const slug = sanitizeSlug(body.slug ?? "");
      const contributorName = (body.contributorName ?? "").trim().slice(0, CONTRIBUTOR_MAX_LEN);
      const mimeType = (body.mimeType ?? "").toLowerCase();

      if (!["invitation", "event"].includes(ownerKind) || !slug) {
        return json({ error: "ownerKind and slug are required." }, 400, { requestId: rid });
      }
      if (!contributorName) {
        return json({ error: "contributorName is required." }, 400, { requestId: rid });
      }
      if (!ALLOWED_MIME.has(mimeType)) {
        return json({ error: "Unsupported image type. Use JPG, PNG, or WebP." }, 400, { requestId: rid });
      }

      let b64 = (body.contentBase64 ?? "").trim();
      if (b64.includes(",")) b64 = b64.split(",").pop() ?? b64;
      if (!b64) return json({ error: "contentBase64 is required." }, 400, { requestId: rid });

      let bytes: Uint8Array;
      try {
        const bin = atob(b64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch {
        return json({ error: "contentBase64 is not valid base64." }, 400, { requestId: rid });
      }

      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
        return json({ error: "Photo must be 2 MB or smaller." }, 400, { requestId: rid });
      }

      // Verify the event/invitation is published.
      if (ownerKind === "invitation") {
        const { data: ev } = await admin
          .from("events")
          .select("id")
          .eq("slug", slug)
          .eq("status", "published")
          .maybeSingle();
        if (!ev?.id) return json({ error: "This invitation is not published." }, 404, { requestId: rid });
      } else {
        const { data: ev } = await admin
          .from("em_events")
          .select("id")
          .eq("slug", slug)
          .eq("status", "PUBLISHED")
          .maybeSingle();
        if (!ev?.id) return json({ error: "This event is not published." }, 404, { requestId: rid });
      }

      // Check album cap.
      const { count, error: countErr } = await admin
        .from("gallery_photos")
        .select("id", { count: "exact", head: true })
        .eq("owner_kind", ownerKind)
        .eq("owner_slug", slug);
      if (countErr) {
        console.error(JSON.stringify({ requestId: rid, msg: "gallery_count_failed", error: countErr.message }));
        return json({ error: "Could not check the album." }, 500, { requestId: rid });
      }
      if ((count ?? 0) >= MAX_ALBUM_PHOTOS) {
        return json({ error: `This album is full (${MAX_ALBUM_PHOTOS} photos maximum).` }, 409, { requestId: rid });
      }

      // Upload to Storage.
      const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const mid = mediaId();
      const path = `gallery/${ownerKind}/${slug}/${mid}.${ext}`;

      const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: mimeType,
        upsert: false,
        cacheControl: "31536000",
      });
      if (uploadErr) {
        console.error(JSON.stringify({ requestId: rid, msg: "gallery_upload_failed", error: uploadErr.message }));
        return json({ error: "Could not store the photo." }, 500, { requestId: rid });
      }

      const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
      const photoUrl = publicData?.publicUrl;
      if (!photoUrl) {
        return json({ error: "Could not resolve the photo URL." }, 500, { requestId: rid });
      }

      // Determine contributor role.
      let contributorRole: "host" | "guest" = "guest";
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        try {
          const userId = await requireUserId(authHeader);
          if (ownerKind === "invitation") {
            const { data: ev } = await anonClient(authHeader).from("events").select("id").eq("slug", slug).eq("user_id", userId).maybeSingle();
            if (ev?.id) contributorRole = "host";
          } else {
            const { data: ev } = await admin.from("em_events").select("id").eq("slug", slug).eq("created_by", userId).maybeSingle();
            if (ev?.id) contributorRole = "host";
          }
        } catch {
          // stays guest
        }
      }

      const token = deleteToken();
      const photoId = `gp_${mid}`;
      const { error: insertErr } = await admin.from("gallery_photos").insert({
        id: photoId,
        owner_kind: ownerKind,
        owner_slug: slug,
        bucket: BUCKET,
        path,
        url: photoUrl,
        contributor_name: contributorName,
        contributor_role: contributorRole,
        delete_token: token,
      });
      if (insertErr) {
        console.error(JSON.stringify({ requestId: rid, msg: "gallery_insert_failed", error: insertErr.message }));
        return json({ error: "Could not save the photo record." }, 500, { requestId: rid });
      }

      console.log(JSON.stringify({ requestId: rid, event: "gallery_upload", photoId, slug, ownerKind, bytes: bytes.byteLength }));
      return json(
        { photo: { id: photoId, url: photoUrl, contributorName, contributorRole, createdAt: new Date().toISOString() }, deleteToken: token },
        201,
        { requestId: rid },
      );
    }

    // --------------------------------------------------------------- DELETE
    if (req.method === "DELETE") {
      type DeleteBody = {
        ownerKind: string;
        slug: string;
        id: string;
        deleteToken?: string;
      };
      const body = await readJson<DeleteBody>(req);
      const photoId = (body.id ?? "").trim();
      const ownerKind = (body.ownerKind ?? "").toLowerCase();
      const slug = sanitizeSlug(body.slug ?? "");

      if (!photoId || !["invitation", "event"].includes(ownerKind) || !slug) {
        return json({ error: "id, ownerKind, and slug are required." }, 400, { requestId: rid });
      }

      const { data: row, error: fetchErr } = await admin
        .from("gallery_photos")
        .select("id, path, delete_token, owner_kind, owner_slug")
        .eq("id", photoId)
        .eq("owner_kind", ownerKind)
        .eq("owner_slug", slug)
        .maybeSingle();

      if (fetchErr || !row) {
        return json({ error: "Photo not found." }, 404, { requestId: rid });
      }

      // Allow delete if: token matches OR caller is the event/invitation host.
      let authorized = false;
      const suppliedToken = (body.deleteToken ?? "");
      if (suppliedToken && timingSafeEqual(suppliedToken, row.delete_token as string)) {
        authorized = true;
      }
      if (!authorized) {
        const authHeader = req.headers.get("Authorization");
        if (authHeader) {
          try {
            const userId = await requireUserId(authHeader);
            if (ownerKind === "invitation") {
              const { data: ev } = await anonClient(authHeader).from("events").select("id").eq("slug", slug).eq("user_id", userId).maybeSingle();
              if (ev?.id) authorized = true;
            } else {
              const { data: ev } = await admin.from("em_events").select("id").eq("slug", slug).eq("created_by", userId).maybeSingle();
              if (ev?.id) authorized = true;
            }
          } catch {
            // stays unauthorized
          }
        }
      }
      if (!authorized) {
        return json({ error: "Not authorized to delete this photo." }, 403, { requestId: rid });
      }

      // Delete from DB then Storage.
      const { error: delErr } = await admin.from("gallery_photos").delete().eq("id", photoId);
      if (delErr) {
        console.error(JSON.stringify({ requestId: rid, msg: "gallery_db_delete_failed", error: delErr.message }));
        return json({ error: "Could not delete the photo." }, 500, { requestId: rid });
      }
      await admin.storage.from(BUCKET).remove([row.path as string]).catch(() => {/* best-effort */});

      return json({ deleted: true }, 200, { requestId: rid });
    }

    return json({ error: "Method not allowed." }, 405, { requestId: rid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHORIZED") {
      return json({ error: "Unauthorized." }, 401, { requestId: rid });
    }
    console.error(JSON.stringify({ requestId: rid, msg: "gallery_unhandled", error: message }));
    return json({ error: message }, 500, { requestId: rid });
  }
});
