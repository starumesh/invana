import { isBrowserLocalMediaUrl } from "@/lib/mediaUrl";
import type { StoredEvent } from "@/types";

/** Field keys whose string values are still browser-local (blob:/data:). */
export function localMediaFieldKeys(event: StoredEvent): string[] {
  const fields = event.config?.fields;
  if (!fields || typeof fields !== "object") return [];
  return Object.entries(fields)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && isBrowserLocalMediaUrl(entry[1]),
    )
    .map(([key]) => key);
}

/**
 * Phase 0 invariant: published / export-bound configs must not embed blob:/data: URLs.
 * Throws a user-facing Error when local media remains.
 */
export function assertDurableMediaForPublish(event: StoredEvent): void {
  const keys = localMediaFieldKeys(event);
  if (!keys.length) return;
  throw new Error(
    `Photos must upload to cloud storage before publish (${keys.join(", ")}). Sign in and save again.`,
  );
}
