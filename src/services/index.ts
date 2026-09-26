import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchPublicInviteBySlug } from "@/services/api/inviteApi";
import { createPublicRsvpViaEdge } from "@/services/api/rsvpApi";
import { EdgeApiError } from "@/services/api/edgeClient";
import { demoAuth, demoMessaging, demoPersistence } from "@/services/demo";
import { demoStorage } from "@/services/demoStorage";
import { supabaseAuth } from "@/services/supabase/auth";
import { cloudMessaging } from "@/services/supabase/messaging";
import { supabasePersistence } from "@/services/supabase/persistence";
import { supabaseStorage } from "@/services/supabase/storage";
import type { AuthProvider, MessagingProvider, PersistenceProvider, StorageProvider } from "@/services/types";
import type { Rsvp, StoredEvent } from "@/types";

export { isSupabaseConfigured };

export const isDemoMode = !isSupabaseConfigured();

function messagingMode(): "demo" | "cloud" | "wa_me" {
  const raw = (import.meta.env.VITE_MESSAGING_MODE ?? "").trim().toLowerCase();
  if (raw === "cloud" || raw === "wa_me" || raw === "demo") return raw;
  // Connected persistence does not imply Cloud API — default to wa.me until explicitly enabled.
  return isDemoMode ? "demo" : "wa_me";
}

/**
 * When true, Download requires sign-in in Connected Mode.
 * Publish / Share always require sign-in when Connected.
 * Demo Mode never gates. Default: true (unset = require sign-in for download).
 */
export function isSignInRequired(): boolean {
  if (isDemoMode) return false;
  const raw = (import.meta.env.VITE_REQUIRE_SIGN_IN ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

export const auth: AuthProvider = isDemoMode ? demoAuth : supabaseAuth;
/** Default Connected adapter; prefer `activePersistence()` so guests can edit locally before sign-in. */
export const persistence: PersistenceProvider = isDemoMode ? demoPersistence : supabasePersistence;
/** Default Connected adapter; prefer `activeStorage()` so guests keep browser-local media until sign-in. */
export const storage: StorageProvider = isDemoMode ? demoStorage : supabaseStorage;

export const messaging: MessagingProvider =
  !isDemoMode && messagingMode() === "cloud" ? cloudMessaging : demoMessaging;

/** True when Demo Mode, or Connected with a real Supabase session. */
export function hasAuthSession(): boolean {
  if (isDemoMode) return true;
  const user = supabaseAuth.currentUser();
  return Boolean(user?.id && user.id !== "unauthenticated");
}

/**
 * Persistence for the current session: remote when signed in to Supabase,
 * otherwise localStorage so templates / create / builder work without sign-in.
 */
export function activePersistence(): PersistenceProvider {
  if (isDemoMode) return demoPersistence;
  return hasAuthSession() ? supabasePersistence : demoPersistence;
}

/**
 * Media uploads: Supabase Storage when signed in to Connected Mode,
 * otherwise browser data URLs (Demo Mode or signed-out guest).
 */
export function activeStorage(): StorageProvider {
  if (isDemoMode) return demoStorage;
  return hasAuthSession() ? supabaseStorage : demoStorage;
}

/**
 * Async storage picker — prefers a live Supabase session (not only the sync cache)
 * so uploads after sign-in hit Storage even if AuthSession cache is briefly cold.
 */
export async function resolveActiveStorage(): Promise<StorageProvider> {
  if (isDemoMode) return demoStorage;
  if (hasAuthSession()) return supabaseStorage;
  const sb = getSupabase();
  if (!sb) return demoStorage;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ? supabaseStorage : demoStorage;
}

/**
 * Public invite lookup: prefer Edge Invite Read API (Phase 1), then PostgREST,
 * then local published mirror. Never prefer a local draft over a cloud publish.
 */
export async function resolveEventBySlug(slug: string): Promise<StoredEvent | null> {
  const local = await demoPersistence.getBySlug(slug);
  if (isDemoMode) return local;

  let remote: StoredEvent | null = null;

  try {
    remote = await fetchPublicInviteBySlug(slug);
  } catch {
    // Function not deployed / network / non-404 errors — fall through to PostgREST.
    remote = null;
  }

  if (!remote) {
    try {
      remote = await supabasePersistence.getBySlug(slug);
    } catch {
      remote = null;
    }
  }

  if (remote?.status === "published") {
    await demoPersistence.saveEvent(remote);
    return remote;
  }
  if (local?.status === "published") return local;
  return remote ?? local;
}

export type AddPublicRsvpOptions = {
  /** Invite slug — preferred so the RSVP Edge service can resolve published status. */
  slug?: string;
};

/**
 * Guest RSVP: Connected Mode always writes to the cloud SoR so hosts see replies
 * from any device/browser. Prefer the RSVP Edge API; fall back to PostgREST insert.
 * Do not silently fall back to localStorage.
 */
export async function addPublicRsvp(rsvp: Rsvp, opts?: AddPublicRsvpOptions): Promise<Rsvp> {
  if (isDemoMode) return demoPersistence.addRsvp(rsvp);

  let saved: Rsvp | null = null;
  try {
    saved = await createPublicRsvpViaEdge(rsvp, { slug: opts?.slug });
  } catch (err) {
    // If Edge is missing (404 function) or gateway error, try PostgREST.
    if (err instanceof EdgeApiError && err.status !== 404 && err.status < 500) {
      throw err;
    }
    saved = null;
  }

  if (!saved) {
    saved = await supabasePersistence.addRsvp(rsvp);
  }

  try {
    await demoPersistence.addRsvp(saved);
  } catch {
    /* ignore local mirror failures — cloud row is source of truth */
  }
  return saved;
}

export function modeLabel() {
  if (isDemoMode) return "Demo Mode";
  const msg = messagingMode();
  if (msg === "cloud") return "Connected (WhatsApp Cloud)";
  return "Connected";
}

export function messagingLabel() {
  const mode = messagingMode();
  if (mode === "cloud" && !isDemoMode) return "WhatsApp Cloud API";
  return "WhatsApp wa.me";
}
