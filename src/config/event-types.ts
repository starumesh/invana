import type { EventTypeId } from "@/types";

export type EventTypeMeta = {
  id: EventTypeId;
  name: string;
  description: string;
  accent: string;
};

export const EVENT_TYPES: EventTypeMeta[] = [
  { id: "wedding", name: "Wedding", description: "Ceremonies, receptions, and family celebrations", accent: "#b8956a" },
  { id: "engagement", name: "Engagement", description: "Ring ceremonies and intimate announcements", accent: "#c27c8a" },
  { id: "birthday", name: "Birthday", description: "Kids, adults, and milestone years", accent: "#d97757" },
  { id: "gruha-pravesham", name: "Gruha Pravesham", description: "Housewarming with traditional warmth", accent: "#c4a35a" },
  { id: "sangeet", name: "Sangeet", description: "Music, dance, and festive nights", accent: "#7c3aed" },
  { id: "haldi", name: "Haldi", description: "Turmeric, florals, and morning light", accent: "#e3b341" },
  { id: "baby-shower", name: "Baby Shower", description: "Welcoming a new little guest", accent: "#e8a0bf" },
  { id: "anniversary", name: "Anniversary", description: "Years together, told beautifully", accent: "#9a6b4f" },
  { id: "reception", name: "Reception", description: "Evening gatherings after the vows", accent: "#2f3e46" },
  { id: "housewarming", name: "Housewarming", description: "Open doors and new beginnings", accent: "#6b8f71" },
  { id: "naming-ceremony", name: "Naming Ceremony", description: "A first name, a first celebration", accent: "#7a9e9f" },
  { id: "mehendi", name: "Mehendi", description: "Henna, gardens, and gold", accent: "#c05621" },
  { id: "save-the-date", name: "Save the Date", description: "A first look at what is coming", accent: "#4b5563" },
  { id: "party", name: "Party", description: "Any gathering that deserves a card", accent: "#2563eb" },
  { id: "custom", name: "Custom Event", description: "Start from a blank, elegant canvas", accent: "#1c1917" },
];

export function getEventType(id: EventTypeId): EventTypeMeta {
  return EVENT_TYPES.find((item) => item.id === id) ?? EVENT_TYPES[0];
}
