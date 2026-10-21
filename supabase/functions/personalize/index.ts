// Invana personalize metadata — validates registration payloads (full upload pipeline can extend here).
// Deploy: `supabase functions deploy personalize`
// Storage: private `event-media` prefix `personalize/{userId}/{documentId}/`

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions } from "../_shared/cors.ts";
import { json, readJson, requestId } from "../_shared/http.ts";
import { requireUserId } from "../_shared/supabase.ts";

const MAX_BYTES = 10 * 1024 * 1024;

type RegisterBody = {
  action: "register";
  documentId: string;
  fileName: string;
  kind: "image" | "pdf";
  width: number;
  height: number;
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
    const body = await readJson<RegisterBody>(req);

    if (body.action !== "register") {
      return json({ error: "Unsupported action." }, 400, { requestId: rid });
    }

    const documentId = (body.documentId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    if (!documentId) {
      return json({ error: "documentId is required." }, 400, { requestId: rid });
    }

    const fileName = (body.fileName || "invitation").slice(0, 200);
    if (body.kind !== "image" && body.kind !== "pdf") {
      return json({ error: "Invalid kind." }, 400, { requestId: rid });
    }

    if (!Number.isFinite(body.width) || !Number.isFinite(body.height) || body.width <= 0 || body.height <= 0) {
      return json({ error: "Invalid canvas dimensions." }, 400, { requestId: rid });
    }

    return json(
      {
        ok: true,
        userId,
        documentId,
        fileName,
        kind: body.kind,
        width: body.width,
        height: body.height,
        maxBytes: MAX_BYTES,
        storagePrefix: `personalize/${userId}/${documentId}`,
      },
      200,
      { requestId: rid },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Personalize request failed.";
    return json({ error: message }, 400, { requestId: rid });
  }
});
