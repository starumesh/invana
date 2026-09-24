import type { EventTypeId } from "@/types";

const SHARED = [
  "Together with our families, we invite you to celebrate with us.",
  "With great joy, we invite you to join us.",
  "Please join us as we celebrate.",
  "You are cordially invited.",
];

export const WELCOME_MESSAGES: Record<EventTypeId, string[]> = {
  wedding: [
    "Together with our families, we invite you to celebrate our wedding.",
    "With the blessings of our elders, we request the pleasure of your company.",
    "Please join us as we begin our life together.",
    "You are cordially invited to witness our wedding.",
  ],
  engagement: [
    "With joy in our hearts, we invite you to our engagement.",
    "Please celebrate with us as we promise a lifetime together.",
    ...SHARED.slice(2),
  ],
  birthday: [
    "You are invited to a birthday celebration.",
    "Please join us as we mark another year of joy.",
    "Come celebrate — cake, music, and good company.",
  ],
  "gruha-pravesham": [
    "With the blessings of the divine, we invite you to our Gruha Pravesham.",
    "Please join our family as we step into our new home.",
    "Your presence will make our new beginning complete.",
  ],
  sangeet: [
    "Come dance, sing, and celebrate with us at our Sangeet.",
    "An evening of music and family — you are invited.",
    "Join us for a night of rhythm, colour, and joy.",
  ],
  haldi: [
    "You are invited to our Haldi ceremony.",
    "Join us for turmeric, laughter, and morning light.",
    "Please be with us as we begin the wedding festivities.",
  ],
  "baby-shower": [
    "Please join us as we celebrate a little one on the way.",
    "You are invited to a baby shower filled with love.",
  ],
  anniversary: [
    "Celebrate another year of togetherness with us.",
    "You are invited to our anniversary gathering.",
  ],
  reception: [
    "Please join us for an evening reception.",
    "We would be honoured by your presence at our reception.",
  ],
  housewarming: [
    "Our doors are open — please join our housewarming.",
    "Celebrate a new home and new memories with us.",
  ],
  "naming-ceremony": [
    "Join us as we name and welcome our little one.",
    "Your blessings would mean the world at our naming ceremony.",
  ],
  mehendi: [
    "You are invited to our Mehendi celebration.",
    "Henna, gardens, and gold — please join us.",
  ],
  "save-the-date": [
    "Save the date — we cannot wait to celebrate with you.",
    "A first look at a day we hope you will share.",
  ],
  party: SHARED,
  custom: SHARED,
};

export function messagesFor(eventType?: EventTypeId): string[] {
  return eventType ? WELCOME_MESSAGES[eventType] : SHARED;
}
