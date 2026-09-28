export type EventErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DUPLICATE_GUEST"
  | "CAPACITY_REACHED"
  | "INVALID_TRANSITION"
  | "SLUG_TAKEN"
  | "PASS_GENERATION_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL";

export const MESSAGES = {
  createFailed: "Unable to create the event. Please check the required fields.",
  updateFailed: "Unable to update the event. Please check the required fields.",
  passGenerationFailed: "Unable to generate guest passes. Please try again.",
  duplicateGuest: "This guest is already registered for this event.",
  capacityReached: "Maximum event capacity has been reached.",
  alreadyCheckedIn: "This pass has already been checked in.",
  invalidPass: "This pass is invalid.",
  forbidden: "You don't have permission to access this event.",
  unauthorized: "Please sign in to continue.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
  passNotFound: "This pass could not be found. Ask the organizer to resend your pass.",
  eventNotFound: "This event could not be found. It may be unpublished or the link is incorrect.",
} as const;

const STATUS: Record<EventErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DUPLICATE_GUEST: 409,
  CAPACITY_REACHED: 409,
  INVALID_TRANSITION: 409,
  SLUG_TAKEN: 409,
  PASS_GENERATION_FAILED: 500,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export type FieldErrors = Record<string, string>;

export class EventError extends Error {
  code: EventErrorCode;
  status: number;
  fieldErrors?: FieldErrors;
  details?: Record<string, unknown>;

  constructor(
    code: EventErrorCode,
    message: string,
    opts?: { fieldErrors?: FieldErrors; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "EventError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = opts?.fieldErrors;
    this.details = opts?.details;
  }
}

export function isEventError(err: unknown): err is EventError {
  return err instanceof EventError || (typeof err === "object" && err !== null && (err as { name?: string }).name === "EventError");
}
