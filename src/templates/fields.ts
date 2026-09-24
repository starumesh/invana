import type { CardTypeId, ElementSpec, EventTypeId, FieldSpec, TemplateDefinition } from "@/types";

const coreVenue: FieldSpec[] = [
  { key: "venueName", label: "Venue name", type: "text", required: true, group: "Venue", placeholder: "The Leela Palace" },
];

const optionalVenue: FieldSpec[] = [
  { key: "venueAddress", label: "Address", type: "text", group: "More details", placeholder: "123 Lake Road" },
  { key: "city", label: "City", type: "text", group: "More details", placeholder: "Hyderabad" },
  { key: "state", label: "State", type: "text", group: "More details", placeholder: "Telangana" },
  { key: "country", label: "Country", type: "text", group: "More details", placeholder: "India" },
  { key: "locationUrl", label: "Google Maps URL", type: "url", group: "More details", placeholder: "https://maps.google.com/..." },
];

const scheduleFields: FieldSpec[] = [
  { key: "eventDate", label: "Date", type: "date", required: true, group: "When" },
  { key: "eventTime", label: "Time", type: "time", required: true, group: "When" },
];

const optionalSchedule: FieldSpec[] = [
  { key: "timezone", label: "Timezone", type: "text", group: "More details", placeholder: "Asia/Kolkata" },
];

const invitationExtras: FieldSpec[] = [
  { key: "hosts", label: "Hosts", type: "text", group: "More details", placeholder: "With love from both families" },
  { key: "dressCode", label: "Dress code", type: "text", group: "More details", placeholder: "Ethnic festive wear" },
  { key: "rsvpPhone", label: "RSVP phone", type: "phone", group: "More details", placeholder: "+91 98765 43210" },
  { key: "rsvpNote", label: "RSVP note", type: "text", group: "More details", placeholder: "Kindly RSVP by Dec 1" },
  { key: "additionalNote", label: "Additional event note", type: "textarea", group: "More details", maxLength: 160, placeholder: "Dinner to follow · Valet available" },
  { key: "hashtag", label: "Hashtag", type: "text", group: "More details", placeholder: "PriyaWedsRahul" },
  { key: "gifts", label: "Gifts / registry note", type: "text", group: "More details", placeholder: "Your presence is our present" },
];

function messageField(): FieldSpec {
  return {
    key: "invitationMessage",
    label: "Welcome message",
    type: "message",
    required: true,
    group: "Details",
  };
}

/** Unique image field keys from template elements, in first-appearance order. */
export function imageFieldKeysFromElements(elements: ElementSpec[]): string[] {
  const keys: string[] = [];
  for (const el of elements) {
    if (el.type === "image" && el.field && !keys.includes(el.field)) {
      keys.push(el.field);
    }
  }
  return keys;
}

/** Photo upload fields matching the template's actual image slots (0–N unique keys). */
export function photoFieldsFromTemplate(template: TemplateDefinition): FieldSpec[] {
  const keys = imageFieldKeysFromElements(template.elements);
  if (keys.length === 0) return [];

  const collage = keys.length > 1;
  return keys.map((key, index) => {
    let label: string;
    if (collage) {
      label = `Photo ${index + 1}`;
    } else if (key === "coverImage") {
      label = "Cover photo";
    } else {
      label = "Photo";
    }
    return {
      key,
      label,
      type: "image" as const,
      group: key === "photo" && !collage ? "Photo" : "Photos",
    };
  });
}

/** Insert template photo fields after venue (or before optional details). */
export function withTemplatePhotoFields(fields: FieldSpec[], template: TemplateDefinition): FieldSpec[] {
  const photos = photoFieldsFromTemplate(template);
  if (!photos.length) return fields;
  if (fields.some((f) => f.type === "image")) {
    return fields;
  }

  const afterVenue = fields.findIndex((f) => f.key === "venueName");
  if (afterVenue >= 0) {
    return [...fields.slice(0, afterVenue + 1), ...photos, ...fields.slice(afterVenue + 1)];
  }

  const beforeMore = fields.findIndex((f) => f.group === "More details");
  if (beforeMore >= 0) {
    return [...fields.slice(0, beforeMore), ...photos, ...fields.slice(beforeMore)];
  }

  return [...fields, ...photos];
}

export function invitationFields(kind: EventTypeId): FieldSpec[] {
  const message = messageField();
  const sharedTail = [...scheduleFields, ...coreVenue, ...optionalSchedule, ...optionalVenue, ...invitationExtras];
  if (kind === "wedding" || kind === "reception") {
    return [
      { key: "brideName", label: "Bride's name", type: "text", required: true, group: "Details", placeholder: "Priya" },
      { key: "groomName", label: "Groom's name", type: "text", required: true, group: "Details", placeholder: "Rahul" },
      { key: "brideParents", label: "Bride's parents", type: "text", group: "Details", placeholder: "Mr & Mrs Sharma" },
      { key: "groomParents", label: "Groom's parents", type: "text", group: "Details", placeholder: "Mr & Mrs Reddy" },
      message,
      ...sharedTail,
    ];
  }

  if (kind === "engagement" || kind === "sangeet" || kind === "haldi" || kind === "mehendi") {
    return [
      { key: "brideName", label: "Name one", type: "text", required: true, group: "Details", placeholder: "Priya" },
      { key: "groomName", label: "Name two", type: "text", required: true, group: "Details", placeholder: "Rahul" },
      { key: "brideParents", label: "Parents / hosts note", type: "text", group: "Details", placeholder: "Together with their families" },
      message,
      ...sharedTail,
    ];
  }

  if (kind === "birthday") {
    return [
      { key: "celebrantName", label: "Celebrant", type: "text", required: true, group: "Details", placeholder: "Aanya" },
      { key: "age", label: "Age / milestone", type: "text", group: "Details", placeholder: "5" },
      message,
      ...sharedTail,
    ];
  }

  if (kind === "gruha-pravesham" || kind === "housewarming") {
    return [
      { key: "familyName", label: "Family name", type: "text", required: true, group: "Details", placeholder: "The Reddy Family" },
      { key: "eventTitle", label: "Event title", type: "text", group: "Details", placeholder: "Gruha Pravesham" },
      message,
      ...sharedTail,
    ];
  }

  return [
    { key: "hostNames", label: "Host / honoree", type: "text", required: true, group: "Details", placeholder: "The Kapoor Family" },
    { key: "eventTitle", label: "Event title", type: "text", group: "Details", placeholder: "Celebration" },
    message,
    ...sharedTail,
  ];
}

/**
 * Classic marriage biodata fields — PERSONAL / FAMILY / CONTACT,
 * matching a traditional biodata sheet. About & expectations stay optional extras.
 */
export function bioCardFields(): FieldSpec[] {
  return [
    { key: "photo", label: "Portrait photo", type: "image", required: false, group: "Photo" },

    // Personal Details
    { key: "fullName", label: "Name", type: "text", required: true, group: "Personal Details", placeholder: "Mahima Singh" },
    { key: "dateOfBirth", label: "Date of Birth", type: "text", required: false, group: "Personal Details", placeholder: "20 November 1995" },
    { key: "timeOfBirth", label: "Time of Birth", type: "text", required: false, group: "Personal Details", placeholder: "7:20 PM" },
    { key: "placeOfBirth", label: "Place of Birth", type: "text", required: false, group: "Personal Details", placeholder: "New Delhi" },
    { key: "rashi", label: "Rashi", type: "text", required: false, group: "Personal Details", placeholder: "Mesh (Aries)" },
    { key: "nakshatra", label: "Nakshatra", type: "text", required: false, group: "Personal Details", placeholder: "Chitra" },
    { key: "complexion", label: "Complexion", type: "text", required: false, group: "Personal Details", placeholder: "Fair" },
    { key: "height", label: "Height", type: "text", required: false, group: "Personal Details", placeholder: "5 feet 9 inches" },
    { key: "gotra", label: "Gotra", type: "text", required: false, group: "Personal Details", placeholder: "Singh" },
    {
      key: "degree",
      label: "Degree",
      type: "text",
      required: false,
      group: "Personal Details",
      placeholder: "B.COM Hons",
    },
    {
      key: "institution",
      label: "College / University",
      type: "text",
      required: false,
      group: "Personal Details",
      placeholder: "Delhi University",
    },
    {
      key: "graduationYear",
      label: "Graduation year",
      type: "text",
      required: false,
      group: "Personal Details",
      placeholder: "2018",
    },
    {
      key: "occupation",
      label: "Work / Occupation",
      type: "text",
      required: true,
      group: "Personal Details",
      placeholder: "Senior Consultant",
    },
    {
      key: "company",
      label: "Company",
      type: "text",
      required: false,
      group: "Personal Details",
      placeholder: "BCG",
    },

    // Family Details
    { key: "fatherName", label: "Father's Name", type: "text", required: false, group: "Family Details", placeholder: "Sh. Mahender Singh" },
    {
      key: "fatherOccupation",
      label: "Father's Occupation",
      type: "text",
      required: false,
      group: "Family Details",
      placeholder: "Business (Motor Parts Trading)",
    },
    { key: "motherName", label: "Mother's Name", type: "text", required: false, group: "Family Details", placeholder: "Smt. Sunita Singh" },
    {
      key: "motherOccupation",
      label: "Mother's Occupation",
      type: "text",
      required: false,
      group: "Family Details",
      placeholder: "Homemaker",
    },
    { key: "siblings", label: "Siblings", type: "text", required: false, group: "Family Details", placeholder: "1 Brother (Unmarried)" },

    // Contact Details
    {
      key: "contactPerson",
      label: "Contact Person",
      type: "text",
      required: false,
      group: "Contact Details",
      placeholder: "Sh. Mahender Singh",
    },
    { key: "phone", label: "Contact Number", type: "phone", required: true, group: "Contact Details", placeholder: "+91 1129921929" },
    { key: "email", label: "Email ID", type: "email", required: false, group: "Contact Details", placeholder: "mahima.singh@mail.com" },
    {
      key: "residentialAddress",
      label: "Residential Address",
      type: "textarea",
      required: false,
      group: "Contact Details",
      maxLength: 200,
      placeholder: "M-Block, House No 23, Greater Kailash (Self Owned)",
    },

    // Optional extras — do not break the classic 3-section card look
    {
      key: "about",
      label: "About me",
      type: "textarea",
      required: false,
      group: "More (optional)",
      maxLength: 280,
      placeholder: "A short note about yourself (optional)",
    },
    {
      key: "expectations",
      label: "Expectations",
      type: "textarea",
      required: false,
      group: "More (optional)",
      maxLength: 240,
      placeholder: "Partner / life expectations (optional)",
    },
  ];
}

export function cardFields(kind: CardTypeId): FieldSpec[] {
  const photo: FieldSpec = { key: "photo", label: "Photo", type: "image", group: "Photo" };
  if (kind === "bio") {
    return bioCardFields();
  }

  if (kind === "dating-bio") {
    return [
      { key: "fullName", label: "Name", type: "text", required: true, group: "About", placeholder: "Rohan" },
      photo,
      { key: "age", label: "Age", type: "text", group: "About" },
      { key: "location", label: "Location", type: "text", group: "About" },
      { key: "hobbies", label: "Interests", type: "text", group: "About" },
      { key: "about", label: "Short bio", type: "textarea", group: "More details", maxLength: 180 },
      { key: "contact", label: "Handle / contact", type: "text", group: "Contact" },
    ];
  }

  return [
    { key: "fullName", label: "Name", type: "text", required: true, group: "About", placeholder: "Dr Meera Shah" },
    { key: "jobTitle", label: "Title", type: "text", required: true, group: "About", placeholder: "Keynote Speaker" },
    { key: "company", label: "Company / org", type: "text", group: "About" },
    photo,
    { key: "expertise", label: "Expertise", type: "text", group: "About" },
    { key: "education", label: "Education", type: "text", group: "More details" },
    { key: "about", label: "Bio", type: "textarea", group: "More details", maxLength: 240 },
    { key: "website", label: "Website", type: "url", group: "Contact" },
    { key: "linkedin", label: "LinkedIn", type: "url", group: "Contact" },
    { key: "email", label: "Email", type: "email", group: "Contact" },
    { key: "profileUrl", label: "QR URL", type: "url", group: "Contact" },
  ];
}
