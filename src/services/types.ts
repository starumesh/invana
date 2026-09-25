import type { DemoUser, Rsvp, SendResult, StoredEvent } from "@/types";

export interface PersistenceProvider {
  listEvents(userId: string): Promise<StoredEvent[]>;
  getEvent(id: string): Promise<StoredEvent | null>;
  getBySlug(slug: string): Promise<StoredEvent | null>;
  saveEvent(event: StoredEvent): Promise<StoredEvent>;
  deleteEvent(id: string): Promise<void>;
  listRsvps(eventId: string): Promise<Rsvp[]>;
  /** Optional batch RSVP fetch (one round-trip). Falls back to per-event if omitted. */
  listRsvpsForEventIds?(eventIds: string[]): Promise<Rsvp[]>;
  addRsvp(rsvp: Rsvp): Promise<Rsvp>;
  /** Slugs in use; pass `excludeEventId` so an event can keep (or reclaim) its own slug. */
  takenSlugs(excludeEventId?: string): Promise<string[]>;
}

export interface AuthProvider {
  currentUser(): DemoUser | null;
  ensureUser(): DemoUser;
}

export interface MessagingProvider {
  sendText(recipients: string[], text: string): Promise<SendResult[]>;
  sendImage(recipients: string[], text: string, imageUrl: string): Promise<SendResult[]>;
  sendVideo(recipients: string[], text: string, videoUrl: string): Promise<SendResult[]>;
  sendAudio(recipients: string[], text: string, audioUrl: string): Promise<SendResult[]>;
  sendDocument(recipients: string[], text: string, documentUrl: string): Promise<SendResult[]>;
  getDeliveryStatus?(messageId: string): Promise<{ messageId: string; status: string }>;
}

export type UploadedMedia = {
  path: string;
  url: string;
  mimeType: string;
  byteSize: number;
};

export interface StorageProvider {
  uploadImage(opts: { file: File; eventId?: string }): Promise<UploadedMedia>;
}

export interface AIProvider {
  suggestWelcome?(prompt: string): Promise<string[]>;
}
