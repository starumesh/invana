// Invana OG Invite — HTML shell with Open Graph tags for crawlers.
// Deploy: `supabase functions deploy og-invite`
// Wire Netlify/Cloudflare to proxy /invite/:slug bots here after BrowserRouter cutover.
// Product: GET ?slug=… → text/html with og:* pointing at the SPA invite URL.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions } from "../_shared/cors.ts";
import { clientIp, json, requestId, text } from "../_shared/http.ts";
import { toPublicInvite, type EventRow } from "../_shared/inviteProjection.ts";
import { assertRateLimit } from "../_shared/rateLimit.ts";
import { slugKey } from "../_shared/slug.ts";
import { anonClient, serviceClient } from "../_shared/supabase.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fieldText(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstImageUrl(fields: Record<string, unknown>): string {
  for (const value of Object.values(fields)) {
    if (typeof value === "string" && /^https:\/\//i.test(value.trim())) {
      const lower = value.toLowerCase();
      if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(lower) || lower.includes("/storage/")) {
        return value.trim();
      }
    }
  }
  return "";
}

serve(async (req) => {
  const rid = requestId(req);
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    if (req.method !== "GET") {
      return json({ error: "Method not allowed." }, 405, { requestId: rid });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const pathSlug =
      pathParts[pathParts.length - 1] === "og-invite" ? "" : pathParts[pathParts.length - 1] ?? "";
    const key = slugKey(url.searchParams.get("slug") || pathSlug);
    if (!key) {
      return json({ error: "slug is required." }, 400, { requestId: rid });
    }

    const admin = serviceClient();
    const rl = await assertRateLimit(admin, {
      key: `og:${clientIp(req)}`,
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return json({ error: "Too many requests." }, 429, { requestId: rid });
    }

    const site = (Deno.env.get("PUBLIC_SITE_URL") || "https://invana.stream").replace(/\/$/, "");
    const spaUrl = `${site}/invite/${encodeURIComponent(key)}`;

    const sb = anonClient();
    const { data: exactRow } = await sb
      .from("events")
      .select("id, user_id, slug, title, status, config, created_at, updated_at")
      .eq("slug", key)
      .maybeSingle();

    let row = exactRow as EventRow | null;
    if (!row || row.status !== "published") {
      return text(notFoundHtml(site, key), 404, {
        requestId: rid,
        contentType: "text/html; charset=utf-8",
      });
    }

    const invite = toPublicInvite(row);
    const fields =
      invite.config.fields && typeof invite.config.fields === "object"
        ? (invite.config.fields as Record<string, unknown>)
        : {};
    const title = escapeHtml(invite.title?.trim() || "You're Invited");
    const bride = fieldText(fields, "brideName");
    const groom = fieldText(fields, "groomName");
    const host =
      fieldText(fields, "hostNames", "hosts", "celebrantName") ||
      (bride && groom ? `${bride} & ${groom}` : bride || groom);
    const description = escapeHtml(
      [
        `You're invited to ${invite.title?.trim() || "an event"}.`,
        host ? `Hosted by ${host}.` : "",
        "View details and RSVP online with Invana.",
      ]
        .filter(Boolean)
        .join(" "),
    );
    const image = escapeHtml(firstImageUrl(fields) || `${site}/og-default.png`);
    const canonical = escapeHtml(spaUrl);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} | Invana</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Invana" />
  <meta property="og:title" content="${title} | Invana" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} | Invana" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <link rel="canonical" href="${canonical}" />
  <meta http-equiv="refresh" content="0;url=${canonical}" />
</head>
<body>
  <p>Opening <a href="${canonical}">${title}</a>…</p>
</body>
</html>`;

    console.log(JSON.stringify({ requestId: rid, event: "og_invite", slug: key, eventId: row.id }));
    return text(html, 200, { requestId: rid, contentType: "text/html; charset=utf-8" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(JSON.stringify({ requestId: rid, msg: "og_unhandled", error: message }));
    return json({ error: message }, 500, { requestId: rid });
  }
});

function notFoundHtml(site: string, slug: string): string {
  const home = escapeHtml(site);
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>Invitation not found | Invana</title>
<meta name="robots" content="noindex" />
</head><body>
<p>Invitation “${escapeHtml(slug)}” was not found. <a href="${home}">Go to Invana</a></p>
</body></html>`;
}
