import { createId } from "@/lib/id";
import { normalizeSlug } from "@/lib/slug";
import type { AuthProvider, MessagingProvider, PersistenceProvider } from "@/services/types";
import type { DemoUser, Rsvp, SendResult, StoredEvent } from "@/types";

const EVENT_KEY = "invana.events";
const RSVP_KEY = "invana.rsvps";
const USER_KEY = "invana.user";

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function slugKey(slug: string): string {
  try {
    return normalizeSlug(decodeURIComponent(slug));
  } catch {
    return normalizeSlug(slug);
  }
}

export const demoAuth: AuthProvider = {
  currentUser() {
    return read<DemoUser | null>(USER_KEY, null);
  },
  ensureUser() {
    const existing = this.currentUser();
    if (existing) return existing;
    const user: DemoUser = { id: "demo-user", email: "you@local.demo", name: "You" };
    write(USER_KEY, user);
    return user;
  },
};

export const demoPersistence: PersistenceProvider = {
  async listEvents(userId) {
    return read<StoredEvent[]>(EVENT_KEY, []).filter((event) => event.userId === userId);
  },
  async getEvent(id) {
    return read<StoredEvent[]>(EVENT_KEY, []).find((event) => event.id === id) ?? null;
  },
  async getBySlug(slug) {
    const key = slugKey(slug);
    if (!key) return null;
    const matches = read<StoredEvent[]>(EVENT_KEY, []).filter((event) => slugKey(event.slug) === key);
    // Prefer the published event so invite links never resolve to a conflicting draft.
    return matches.find((event) => event.status === "published") ?? matches[0] ?? null;
  },
  async saveEvent(event) {
    const all = read<StoredEvent[]>(EVENT_KEY, []);
    const publishedKey = event.status === "published" ? slugKey(event.slug) : "";

    const next = all.map((item) => {
      if (item.id === event.id) return event;
      // When publishing, free the slug on any other event that collided (common with default titles).
      if (publishedKey && slugKey(item.slug) === publishedKey) {
        const suffix = item.id.replace(/^evt_/, "").slice(-6) || createId("s").slice(-6);
        return { ...item, slug: `${slugKey(item.slug) || "invite"}-${suffix}` };
      }
      return item;
    });

    const index = next.findIndex((item) => item.id === event.id);
    if (index >= 0) next[index] = event;
    else next.unshift(event);

    write(EVENT_KEY, next);
    return event;
  },
  async deleteEvent(id) {
    write(
      EVENT_KEY,
      read<StoredEvent[]>(EVENT_KEY, []).filter((event) => event.id !== id),
    );
  },
  async listRsvps(eventId) {
    return read<Rsvp[]>(RSVP_KEY, []).filter((item) => item.eventId === eventId);
  },
  async addRsvp(rsvp) {
    const all = read<Rsvp[]>(RSVP_KEY, []);
    all.unshift(rsvp);
    write(RSVP_KEY, all);
    return rsvp;
  },
  async takenSlugs(excludeEventId) {
    return read<StoredEvent[]>(EVENT_KEY, [])
      .filter((event) => event.id !== excludeEventId)
      .map((event) => slugKey(event.slug))
      .filter(Boolean);
  },
};

function waLinks(recipients: string[], text: string): SendResult[] {
  return recipients.map((recipient) => {
    const digits = recipient.replace(/\D/g, "");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
    return { recipient, status: "demo" as const, url };
  });
}

export const demoMessaging: MessagingProvider = {
  async sendText(recipients, text) {
    return waLinks(recipients, text);
  },
  async sendImage(recipients, text) {
    return waLinks(recipients, `${text}\n\n(Attach the downloaded image from your phone gallery.)`);
  },
  async sendVideo(recipients, text) {
    return waLinks(recipients, text);
  },
  async sendAudio(recipients, text) {
    return waLinks(recipients, text);
  },
  async sendDocument(recipients, text) {
    return waLinks(recipients, text);
  },
};

export function createDraftId() {
  return createId("evt");
}

/** All events in localStorage (Connected guests + Demo Mode). */
export function readLocalEvents(): StoredEvent[] {
  return read<StoredEvent[]>(EVENT_KEY, []);
}

export function isGuestLocalOwner(userId: string): boolean {
  return userId === "demo-user" || userId === "unauthenticated" || userId === demoAuth.ensureUser().id;
}
