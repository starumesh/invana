import type { RenderInput } from "@/types";

/** Section keys used by the public invitation site. */
export type InviteSectionKey =
  | "hero"
  | "welcome"
  | "countdown"
  | "details"
  | "venue"
  | "map"
  | "gallery"
  | "rsvp"
  | "footer";

/**
 * Resolve whether a guest-site section should render.
 * Missing `config.sections` → V1 defaults (countdown/map/rsvp on when data exists).
 */
export function isSectionEnabled(
  sections: RenderInput["sections"],
  key: InviteSectionKey,
  defaultOn = true,
): boolean {
  if (!sections) return defaultOn;
  if (Object.prototype.hasOwnProperty.call(sections, key)) {
    return Boolean(sections[key]);
  }
  return defaultOn;
}
