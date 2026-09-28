import type { EventStatus, PassStatus } from "./types.ts";

const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["DRAFT", "CANCELLED", "COMPLETED"],
  CANCELLED: [],
  COMPLETED: [],
};

const PASS_TRANSITIONS: Record<PassStatus, PassStatus[]> = {
  ISSUED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CANCELLED"],
  CANCELLED: ["ISSUED"],
};

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return EVENT_TRANSITIONS[from].includes(to);
}

export function canTransitionPass(from: PassStatus, to: PassStatus): boolean {
  return PASS_TRANSITIONS[from].includes(to);
}

/** Organizers may edit details while the event is not terminal. */
export function isEditable(status: EventStatus): boolean {
  return status === "DRAFT" || status === "PUBLISHED";
}

/** Check-in only runs for live events. */
export function acceptsCheckIn(status: EventStatus): boolean {
  return status === "PUBLISHED";
}
