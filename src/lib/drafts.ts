import { createDraftId, demoAuth, demoPersistence, isGuestLocalOwner, readLocalEvents } from "@/services/demo";
import { auth, hasAuthSession, isDemoMode } from "@/services";
import { supabasePersistence } from "@/services/supabase/persistence";
import { defaultFields, displayTitle } from "@/lib/fields";
import { uniqueSlug } from "@/lib/slug";
import { getTemplate } from "@/templates/registry";
import type { CardTypeId, EventTypeId, RenderInput, StoredEvent } from "@/types";

function draftOwnerId(): string {
  if (isDemoMode || hasAuthSession()) {
    return auth.ensureUser().id;
  }
  // Connected but unsigned — keep drafts in localStorage under the demo guest id.
  return demoAuth.ensureUser().id;
}

/**
 * Always mirror to localStorage. When signed in (Connected), also upsert to Supabase.
 * Local-first keeps Create → Builder reliable even if cloud is slow or RLS hiccups.
 */
export async function persistEvent(event: StoredEvent): Promise<StoredEvent> {
  let next = event;

  if (!isDemoMode && hasAuthSession()) {
    const userId = auth.ensureUser().id;
    if (userId && userId !== "unauthenticated" && next.userId !== userId) {
      next = { ...next, userId };
    }
    try {
      next = await supabasePersistence.saveEvent(next);
    } catch {
      // Keep going with local so the builder/invite still work offline / pre-RLS.
    }
  }

  return demoPersistence.saveEvent(next);
}

export async function createDraft(opts: {
  templateId: string;
  eventType?: EventTypeId;
  cardType?: CardTypeId;
}): Promise<StoredEvent> {
  const template = getTemplate(opts.templateId);
  if (!template) throw new Error("That template could not be found.");

  const userId = draftOwnerId();
  const id = createDraftId();
  const config: RenderInput = {
    schemaVersion: 1,
    kind: template.kind,
    eventType: opts.eventType,
    cardType: opts.cardType,
    templateId: template.id,
    fields: defaultFields(template, { eventType: opts.eventType, cardType: opts.cardType }),
    theme: "classic",
  };

  const title = displayTitle(config);
  const now = new Date().toISOString();

  // Prefer cloud taken-slugs when signed in; always merge with local.
  const taken = new Set<string>();
  for (const slug of await demoPersistence.takenSlugs()) taken.add(slug);
  if (!isDemoMode && hasAuthSession()) {
    try {
      for (const slug of await supabasePersistence.takenSlugs()) taken.add(slug);
    } catch {
      /* local list is enough to mint a draft */
    }
  }

  const event: StoredEvent = {
    id,
    userId,
    slug: uniqueSlug([title, opts.eventType ?? opts.cardType ?? "invite"], [...taken]),
    title,
    status: "draft",
    config,
    createdAt: now,
    updatedAt: now,
  };

  return persistEvent(event);
}

/**
 * Upload guest localStorage drafts to Supabase under the signed-in user.
 * Idempotent (same event ids upsert). No-op in Demo Mode or when unsigned.
 */
export async function claimLocalDrafts(): Promise<StoredEvent[]> {
  if (isDemoMode || !hasAuthSession()) return [];
  const userId = auth.ensureUser().id;
  if (!userId || userId === "unauthenticated") return [];

  const guests = readLocalEvents().filter((event) => isGuestLocalOwner(event.userId));
  const claimed: StoredEvent[] = [];

  for (const event of guests) {
    const next: StoredEvent = {
      ...event,
      userId,
      updatedAt: new Date().toISOString(),
    };
    try {
      const stored = await supabasePersistence.saveEvent(next);
      claimed.push(stored);
      await demoPersistence.saveEvent(stored);
    } catch {
      // Leave guest-owned local copy; builder can still open it.
      await demoPersistence.saveEvent(next);
      claimed.push(next);
    }

    const rsvps = await demoPersistence.listRsvps(event.id);
    for (const rsvp of rsvps) {
      try {
        await supabasePersistence.addRsvp(rsvp);
      } catch {
        /* already synced or draft event — ignore */
      }
    }
  }

  return claimed;
}

/**
 * Load a draft for the builder: local always, cloud when signed in.
 * Claims a guest local draft onto the signed-in user when needed.
 */
export async function loadDraftForBuilder(id: string): Promise<StoredEvent | null> {
  const local = await demoPersistence.getEvent(id);

  if (isDemoMode) return local;

  if (hasAuthSession()) {
    try {
      const remote = await supabasePersistence.getEvent(id);
      if (remote) {
        await demoPersistence.saveEvent(remote);
        return remote;
      }
    } catch {
      /* fall through to local */
    }

    if (local) {
      const userId = auth.ensureUser().id;
      const claimed: StoredEvent = {
        ...local,
        userId,
        updatedAt: new Date().toISOString(),
      };
      try {
        const stored = await supabasePersistence.saveEvent(claimed);
        await demoPersistence.saveEvent(stored);
        return stored;
      } catch {
        await demoPersistence.saveEvent(claimed);
        return claimed;
      }
    }
    return null;
  }

  return local;
}
