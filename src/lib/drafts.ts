/**
 * Thin compatibility re-exports — prefer `@/api/events` for new call sites.
 * All persistence / claim / listing logic lives in the events API facade.
 */
export {
  claimLocalDrafts,
  createEventDraft as createDraft,
  deleteEvent,
  getEvent as loadDraftForBuilder,
  isListedEvent,
  listMyEvents as listAccountEvents,
  listRsvpsForEvents,
  listTakenSlugs,
  onAccountSignedIn,
  onAccountSignedOut,
  onAccountSignedOut as switchToBrowserSession,
  peekLocalDraft,
  publishEvent,
  saveEvent as persistEvent,
  saveEvent,
} from "@/api/events";
