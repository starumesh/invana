/**
 * Events API — single facade for create / save / list / delete / publish / claim.
 * UI pages call these functions only; adapters (local guest vs Supabase account) stay here.
 */
import {
  createDraftId,
  demoAuth,
  demoPersistence,
  isGuestLocalOwner,
  mergeLocalEvents,
  readLocalEvents,
  readLocalRsvps,
} from "@/services/demo";
import { auth, isDemoMode } from "@/services";
import { getSupabase } from "@/lib/supabase/client";
import { supabasePersistence } from "@/services/supabase/persistence";
import { blankFields, displayTitle } from "@/lib/fields";
import { uniqueSlug } from "@/lib/slug";
import { getTemplate } from "@/templates/registry";
import type { CardTypeId, EventTypeId, RenderInput, Rsvp, StoredEvent } from "@/types";

/** Guest browser-session owner (Connected, signed out). */
function guestOwnerId(): string {
  return demoAuth.ensureUser().id;
}

/** Deduplicate concurrent claim runs (sign-in + dashboard both may kick off). */
let claimInFlight: Promise<StoredEvent[]> | null = null;

/**
 * Resolve the signed-in Supabase user id (auth.users), not the sync cache.
 * Prefers the in-memory session cache / getSession (no Auth network round-trip).
 * Returns null when Demo Mode is off and there is no session.
 */
async function resolveAccountUserId(): Promise<string | null> {
  if (isDemoMode) {
    const id = auth.ensureUser().id;
    return id && id !== "unauthenticated" ? id : null;
  }

  const cached = auth.currentUser();
  if (cached?.id && cached.id !== "unauthenticated") return cached.id;

  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const id = data.session?.user?.id;
  return id ?? null;
}

/**
 * After sign-out: Connected Mode uses browser localStorage under the guest id.
 * Account events stay in Supabase and reappear on the next sign-in.
 */
export function onAccountSignedOut(): void {
  claimInFlight = null;
  demoAuth.ensureUser();
}

/** AuthSession hook: claim guest library drafts in the background after sign-in. */
export function onAccountSignedIn(): void {
  void claimLocalDrafts().catch(() => {
    /* dashboard / builder will retry when guest drafts remain */
  });
}

/** My events only includes events the user has Saved (or published) at least once. */
export function isListedEvent(event: StoredEvent): boolean {
  return event.listed !== false;
}

/**
 * Signed in → Supabase (source of truth) + local mirror.
 * Signed out (Connected) → localStorage guest session only.
 * Always marks the event listed so it appears on My events after Save/Publish.
 */
export async function saveEvent(event: StoredEvent): Promise<StoredEvent> {
  const listed: StoredEvent = { ...event, listed: true };

  if (isDemoMode) {
    return demoPersistence.saveEvent(listed);
  }

  const accountId = await resolveAccountUserId();

  if (!accountId) {
    const next: StoredEvent = {
      ...listed,
      userId: guestOwnerId(),
      updatedAt: listed.updatedAt || new Date().toISOString(),
    };
    return demoPersistence.saveEvent(next);
  }

  const next: StoredEvent = {
    ...listed,
    userId: accountId,
    updatedAt: listed.updatedAt || new Date().toISOString(),
  };

  const stored = await supabasePersistence.saveEvent(next);
  // Preserve listed:true — cloud row has no listed column, so merge it back.
  const mirrored: StoredEvent = { ...stored, listed: true };
  await demoPersistence.saveEvent(mirrored);
  return mirrored;
}

/**
 * Create a draft locally (instant) and navigate-ready.
 * Stays unlisted (`listed: false`) until the user explicitly Saves in the builder.
 * No cloud upsert here — keep Use → Builder fast.
 */
export async function createEventDraft(opts: {
  templateId: string;
  eventType?: EventTypeId;
  cardType?: CardTypeId;
}): Promise<StoredEvent> {
  const template = getTemplate(opts.templateId);
  if (!template) throw new Error("That template could not be found.");

  // Prefer in-memory auth cache — never block create on getUser / getSession.
  const cachedId = isDemoMode ? auth.ensureUser().id : auth.currentUser()?.id;
  const userId = cachedId && cachedId !== "unauthenticated" ? cachedId : guestOwnerId();
  const id = createDraftId();
  const config: RenderInput = {
    schemaVersion: 1,
    kind: template.kind,
    eventType: opts.eventType,
    cardType: opts.cardType,
    templateId: template.id,
    fields: blankFields(template, { eventType: opts.eventType, cardType: opts.cardType }),
    theme: "classic",
  };

  const title = displayTitle(config);
  const now = new Date().toISOString();

  // Local slugs only — cloud uniqueness is enforced on publish / background sync.
  const taken = await demoPersistence.takenSlugs();

  const event: StoredEvent = {
    id,
    userId,
    slug: uniqueSlug([title, opts.eventType ?? opts.cardType ?? "invite"], taken),
    title,
    status: "draft",
    config,
    createdAt: now,
    updatedAt: now,
    // Working draft only — excluded from My events until first explicit Save.
    listed: false,
  };

  await demoPersistence.saveEvent(event);
  return event;
}

function guestDraftsPending(): StoredEvent[] {
  return readLocalEvents().filter((event) => isGuestLocalOwner(event.userId));
}

/** Guest drafts that belong in the account library (already Saved at least once). */
function guestListedDraftsPending(): StoredEvent[] {
  return guestDraftsPending().filter(isListedEvent);
}

/**
 * Upload this browser’s guest drafts (+ their local RSVPs) to Supabase.
 * Idempotent. No-op in Demo Mode, when signed out, or when no guest drafts remain.
 * Does NOT re-upsert already-synced account mirrors.
 * Never-saved working drafts (`listed: false`) stay local-only until saveEvent.
 */
export async function claimLocalDrafts(): Promise<StoredEvent[]> {
  if (isDemoMode) return [];
  if (claimInFlight) return claimInFlight;

  claimInFlight = (async () => {
    const userId = await resolveAccountUserId();
    if (!userId) return [];

    const guests = guestListedDraftsPending();
    if (!guests.length) return [];

    const claimed: StoredEvent[] = await Promise.all(
      guests.map(async (event) => {
        const next: StoredEvent = {
          ...event,
          userId,
          listed: true,
          updatedAt: new Date().toISOString(),
        };
        try {
          const stored = await supabasePersistence.saveEvent(next);
          return { ...stored, listed: true };
        } catch {
          return next;
        }
      }),
    );

    mergeLocalEvents(claimed);

    await Promise.all(
      guests.map(async (event) => {
        const rsvps = await demoPersistence.listRsvps(event.id);
        await Promise.all(
          rsvps.map(async (rsvp) => {
            try {
              await supabasePersistence.addRsvp(rsvp);
            } catch {
              /* already synced or draft — ignore */
            }
          }),
        );
      }),
    );

    return claimed;
  })().finally(() => {
    claimInFlight = null;
  });

  return claimInFlight;
}

/**
 * Load events for My events:
 * - Signed in → list from Supabase ASAP (claim guest drafts in background if any).
 * - Signed out → browser guest session only.
 * Never-saved createEventDraft working drafts (`listed: false`) are excluded.
 */
export async function listMyEvents(): Promise<StoredEvent[]> {
  if (isDemoMode) {
    const events = await demoPersistence.listEvents(auth.ensureUser().id);
    return events.filter(isListedEvent);
  }

  const accountId = await resolveAccountUserId();
  if (!accountId) {
    const events = await demoPersistence.listEvents(guestOwnerId());
    return events.filter(isListedEvent);
  }

  const guests = guestListedDraftsPending();
  if (guests.length) {
    // Fire-and-forget — do not block My events on claim/upsert.
    void claimLocalDrafts();
  }

  const remote = await supabasePersistence.listEvents(accountId);
  // One localStorage write for the whole remote list (not N sequential awaits).
  // Preserve local listed:false for ids that somehow appear remote (should not for new drafts).
  const localById = new Map(readLocalEvents().map((event) => [event.id, event]));
  const remoteForMirror = remote.map((event) => {
    const local = localById.get(event.id);
    if (local && local.listed === false) return { ...event, listed: false };
    return { ...event, listed: local?.listed ?? true };
  });
  mergeLocalEvents(remoteForMirror);

  const listedRemote = remoteForMirror.filter(isListedEvent);
  if (!guests.length) return listedRemote;

  // Show pending guest (already-saved) drafts immediately while claim finishes.
  const remoteIds = new Set(listedRemote.map((event) => event.id));
  return [
    ...listedRemote,
    ...guests.filter((event) => !remoteIds.has(event.id) && isListedEvent(event)),
  ];
}

/**
 * Batch-load RSVPs for a set of events (one query when signed in to Supabase).
 */
export async function listRsvpsForEvents(eventIds: string[]): Promise<Map<string, Rsvp[]>> {
  const map = new Map<string, Rsvp[]>();
  for (const id of eventIds) map.set(id, []);
  if (!eventIds.length) return map;

  if (isDemoMode) {
    for (const rsvp of readLocalRsvps()) {
      if (!map.has(rsvp.eventId)) continue;
      map.get(rsvp.eventId)!.push(rsvp);
    }
    return map;
  }

  const accountId = await resolveAccountUserId();
  if (!accountId) {
    for (const rsvp of readLocalRsvps()) {
      if (!map.has(rsvp.eventId)) continue;
      map.get(rsvp.eventId)!.push(rsvp);
    }
    return map;
  }

  try {
    const all = await supabasePersistence.listRsvpsForEventIds!(eventIds);
    for (const rsvp of all) {
      map.get(rsvp.eventId)?.push(rsvp);
    }
  } catch {
    for (const rsvp of readLocalRsvps()) {
      if (!map.has(rsvp.eventId)) continue;
      map.get(rsvp.eventId)!.push(rsvp);
    }
  }
  return map;
}

/** Sync read of a local draft — used to paint the builder before any await. */
export function peekLocalDraft(id: string): StoredEvent | null {
  return readLocalEvents().find((event) => event.id === id) ?? null;
}

/**
 * When a local draft exists, reconcile with Supabase in the background so the
 * builder can open immediately.
 */
function reconcileLocalDraftWithCloud(local: StoredEvent): void {
  if (isDemoMode) return;
  void (async () => {
    try {
      const accountId = await resolveAccountUserId();
      if (!accountId) return;

      try {
        const remote = await supabasePersistence.getEvent(local.id);
        if (remote) {
          if (remote.updatedAt >= local.updatedAt) {
            // Keep never-saved local flag if the user has not Saved yet.
            const merged: StoredEvent =
              local.listed === false ? { ...remote, listed: false } : { ...remote, listed: true };
            await demoPersistence.saveEvent(merged);
          }
          return;
        }
      } catch {
        /* fall through to upsert */
      }

      // Never-saved working drafts stay local-only until saveEvent.
      if (local.listed === false) return;

      const claimed: StoredEvent = {
        ...local,
        userId: accountId,
        listed: true,
        updatedAt: new Date().toISOString(),
      };
      try {
        const stored = await supabasePersistence.saveEvent(claimed);
        await demoPersistence.saveEvent({ ...stored, listed: true });
      } catch {
        await demoPersistence.saveEvent(claimed);
      }
    } catch {
      /* ignore — editor already has the local draft */
    }
  })();
}

/**
 * Load a draft for the builder.
 * Prefer the local mirror immediately so Use → Builder never waits on cloud.
 * Cloud fetch / claim runs in the background when a local copy exists.
 */
export async function getEvent(id: string): Promise<StoredEvent | null> {
  const local = await demoPersistence.getEvent(id);

  if (isDemoMode) return local;

  if (local) {
    reconcileLocalDraftWithCloud(local);
    return local;
  }

  // Cold open (no local mirror): fetch from cloud when signed in.
  const accountId = await resolveAccountUserId();
  if (accountId) {
    try {
      const remote = await supabasePersistence.getEvent(id);
      if (remote) {
        await demoPersistence.saveEvent(remote);
        return remote;
      }
    } catch {
      /* no remote */
    }
  }

  return null;
}

/** Delete from account store (when signed in) and always clear local mirror. */
export async function deleteEvent(id: string): Promise<void> {
  if (isDemoMode) {
    await demoPersistence.deleteEvent(id);
    return;
  }

  const accountId = await resolveAccountUserId();
  if (accountId) {
    try {
      await supabasePersistence.deleteEvent(id);
    } catch {
      /* may only exist locally */
    }
  }

  await demoPersistence.deleteEvent(id);
}

/**
 * Publish (or update published slug) via the same persistence path as save.
 * Marks listed so the event appears on My events.
 */
export async function publishEvent(event: StoredEvent, slug: string): Promise<StoredEvent> {
  return saveEvent({
    ...event,
    slug,
    status: "published",
    title: displayTitle(event.config),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Slugs already in use for the current session store
 * (guest local, or Supabase when signed in). Used by Publish UX to check availability.
 */
export async function listTakenSlugs(excludeEventId?: string): Promise<string[]> {
  if (isDemoMode) return demoPersistence.takenSlugs(excludeEventId);

  const accountId = await resolveAccountUserId();
  if (!accountId) return demoPersistence.takenSlugs(excludeEventId);

  return supabasePersistence.takenSlugs(excludeEventId);
}
