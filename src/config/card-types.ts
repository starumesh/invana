import type { CardTypeId } from "@/types";

export type CardTypeMeta = {
  id: CardTypeId;
  name: string;
  description: string;
};

/** Legacy deep-link / draft ids that map onto a current CardTypeId. */
const CARD_TYPE_ALIASES: Record<string, CardTypeId> = {
  "marriage-bio": "bio",
  biodata: "bio",
  "bio-data": "bio",
};

export const CARD_TYPES: CardTypeMeta[] = [
  {
    id: "bio",
    name: "Bio Data",
    description: "Classic marriage biodata — personal, family, and contact details",
  },
  { id: "dating-bio", name: "Dating Bio", description: "A short, warm first impression" },
  { id: "conference-speaker", name: "Conference Speaker", description: "Talk title, company, and contact" },
  { id: "seminar-speaker", name: "Seminar Speaker", description: "Session-ready professional cards" },
  { id: "professional", name: "Professional Profile", description: "Title, expertise, and links" },
  { id: "personal-intro", name: "Personal Introduction", description: "A simple, elegant who-I-am card" },
  { id: "birthday-profile", name: "Birthday Profile", description: "A celebratory snapshot of someone" },
  { id: "family-intro", name: "Family Introduction", description: "Parents, siblings, and home" },
  { id: "event-host", name: "Event Host", description: "Host details for the invitation site" },
  { id: "custom-card", name: "Custom Profile Card", description: "Your own fields, your own story" },
];

const VALID_CARD_IDS = new Set(CARD_TYPES.map((t) => t.id));

/** Resolve a URL/draft card type id, including legacy marriage-bio → bio. */
export function normalizeCardType(raw: string | null | undefined): CardTypeId | undefined {
  if (!raw) return undefined;
  const aliased = CARD_TYPE_ALIASES[raw] ?? raw;
  return VALID_CARD_IDS.has(aliased as CardTypeId) ? (aliased as CardTypeId) : undefined;
}

export function isBioCardType(cardType?: CardTypeId | string | null): boolean {
  if (!cardType) return false;
  return normalizeCardType(cardType) === "bio" || cardType === "bio" || cardType === "marriage-bio";
}
