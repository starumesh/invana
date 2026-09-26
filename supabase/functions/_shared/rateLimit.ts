import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

/**
 * Fixed-window rate limit backed by Postgres (`api_rate_buckets`).
 * Fail-open if the table is missing so local/dev without the migration still works.
 */
export async function assertRateLimit(
  admin: SupabaseClient,
  opts: { key: string; limit: number; windowSeconds: number },
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStartMs = Math.floor(now.getTime() / (opts.windowSeconds * 1000)) * opts.windowSeconds * 1000;
  const windowStart = new Date(windowStartMs).toISOString();
  const bucketKey = `${opts.key}:${windowStartMs}`;

  try {
    const { data: existing, error: readErr } = await admin
      .from("api_rate_buckets")
      .select("hit_count, window_start")
      .eq("bucket_key", bucketKey)
      .maybeSingle();

    if (readErr) {
      // Table missing or RLS — fail open for early deploys.
      console.warn(JSON.stringify({ msg: "rate_limit_read_failed", error: readErr.message }));
      return { allowed: true, remaining: opts.limit };
    }

    const hits = (existing?.hit_count as number | undefined) ?? 0;
    if (hits >= opts.limit) {
      return { allowed: false, remaining: 0 };
    }

    const next = hits + 1;
    const { error: writeErr } = await admin.from("api_rate_buckets").upsert({
      bucket_key: bucketKey,
      window_start: windowStart,
      hit_count: next,
      updated_at: now.toISOString(),
    });
    if (writeErr) {
      console.warn(JSON.stringify({ msg: "rate_limit_write_failed", error: writeErr.message }));
      return { allowed: true, remaining: opts.limit - next };
    }
    return { allowed: true, remaining: Math.max(0, opts.limit - next) };
  } catch (err) {
    console.warn(JSON.stringify({ msg: "rate_limit_exception", error: String(err) }));
    return { allowed: true, remaining: opts.limit };
  }
}
