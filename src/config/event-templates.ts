import { DEFAULT_EVENT_TYPES } from "@event-core";

export type TimelineTemplateItem = { offsetMinutes: number; durationMinutes: number; title: string; description?: string };

export type EventTemplate = {
  eventType: string;
  durationMinutes: number;
  descriptionHint: string;
  timeline: TimelineTemplateItem[];
};

/** Starting points per event type. Event types are free text, so this list can grow freely. */
export const EVENT_TEMPLATES: Record<string, EventTemplate> = {
  Wedding: {
    eventType: "Wedding",
    durationMinutes: 360,
    descriptionHint: "Join us as we celebrate our wedding with family and friends.",
    timeline: [
      { offsetMinutes: 0, durationMinutes: 60, title: "Baraat & welcome" },
      { offsetMinutes: 60, durationMinutes: 120, title: "Wedding ceremony" },
      { offsetMinutes: 180, durationMinutes: 60, title: "Blessings & photos" },
      { offsetMinutes: 240, durationMinutes: 120, title: "Dinner reception" },
    ],
  },
  Birthday: {
    eventType: "Birthday",
    durationMinutes: 180,
    descriptionHint: "Come celebrate with cake, music, and good company.",
    timeline: [
      { offsetMinutes: 0, durationMinutes: 45, title: "Welcome & games" },
      { offsetMinutes: 45, durationMinutes: 30, title: "Cake cutting" },
      { offsetMinutes: 75, durationMinutes: 105, title: "Dinner & music" },
    ],
  },
  Engagement: {
    eventType: "Engagement",
    durationMinutes: 240,
    descriptionHint: "Celebrate the engagement with us.",
    timeline: [
      { offsetMinutes: 0, durationMinutes: 60, title: "Welcome" },
      { offsetMinutes: 60, durationMinutes: 60, title: "Ring ceremony" },
      { offsetMinutes: 120, durationMinutes: 120, title: "Dinner" },
    ],
  },
  Sangeet: {
    eventType: "Sangeet",
    durationMinutes: 240,
    descriptionHint: "An evening of music, dance, and celebration.",
    timeline: [
      { offsetMinutes: 0, durationMinutes: 30, title: "Welcome drinks" },
      { offsetMinutes: 30, durationMinutes: 120, title: "Performances" },
      { offsetMinutes: 150, durationMinutes: 90, title: "Open dance floor & dinner" },
    ],
  },
  Haldi: {
    eventType: "Haldi",
    durationMinutes: 180,
    descriptionHint: "Join us for the Haldi ceremony — wear yellow!",
    timeline: [
      { offsetMinutes: 0, durationMinutes: 90, title: "Haldi ceremony" },
      { offsetMinutes: 90, durationMinutes: 90, title: "Lunch" },
    ],
  },
  "Gruha Pravesham": {
    eventType: "Gruha Pravesham",
    durationMinutes: 240,
    descriptionHint: "Bless our new home with your presence.",
    timeline: [
      { offsetMinutes: 0, durationMinutes: 120, title: "Pooja" },
      { offsetMinutes: 120, durationMinutes: 120, title: "Lunch" },
    ],
  },
  Conference: {
    eventType: "Conference",
    durationMinutes: 480,
    descriptionHint: "A day of talks, workshops, and networking.",
    timeline: [
      { offsetMinutes: 0, durationMinutes: 60, title: "Registration & breakfast" },
      { offsetMinutes: 60, durationMinutes: 180, title: "Morning sessions" },
      { offsetMinutes: 240, durationMinutes: 60, title: "Lunch" },
      { offsetMinutes: 300, durationMinutes: 150, title: "Afternoon sessions" },
      { offsetMinutes: 450, durationMinutes: 30, title: "Closing" },
    ],
  },
  Meetup: {
    eventType: "Meetup",
    durationMinutes: 150,
    descriptionHint: "Talks, demos, and conversations with the community.",
    timeline: [
      { offsetMinutes: 0, durationMinutes: 30, title: "Check-in & networking" },
      { offsetMinutes: 30, durationMinutes: 90, title: "Talks" },
      { offsetMinutes: 120, durationMinutes: 30, title: "Q&A and wrap-up" },
    ],
  },
  Other: { eventType: "Other", durationMinutes: 180, descriptionHint: "", timeline: [] },
};

export const EVENT_TYPE_OPTIONS: string[] = [...DEFAULT_EVENT_TYPES];

export function templateFor(eventType: string): EventTemplate {
  return EVENT_TEMPLATES[eventType] ?? EVENT_TEMPLATES.Other;
}
