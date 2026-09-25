import { formatDate, formatTimeRange, isDateValue, isTimeValue } from "@/lib/date";
import { themeOverlay } from "@/config/themes";
import { messagesFor } from "@/config/welcome-messages";
import { isBioCardType } from "@/config/card-types";
import type { RenderInput, TemplateDefinition } from "@/types";

function text(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Label : value row with padded label so colons line up cleanly. */
function biodataRow(label: string, value: string, pad = 22): string {
  if (!value) return "";
  return `${label.padEnd(pad)}:  ${value}`;
}

function biodataRows(rows: Array<[string, string]>, pad = 22): string {
  return rows.map(([label, value]) => biodataRow(label, value, pad)).filter(Boolean).join("\n");
}

function stringFields(fields: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

export function resolveFields(_template: TemplateDefinition, input: RenderInput, guestName?: string): Record<string, string> {
  const fields = input.fields ?? {};
  const bride = text(fields, "brideName");
  const groom = text(fields, "groomName");
  const host = text(fields, "hostNames");
  const celebrant = text(fields, "celebrantName");
  const family = text(fields, "familyName");
  const title = text(fields, "eventTitle");
  const name = text(fields, "fullName");
  const job = text(fields, "jobTitle");
  const company = text(fields, "company");

  // Wedding / couple events: bride → primaryName, groom → secondaryName (Composition field mapping).
  const isCouple =
    Boolean(bride || groom) ||
    input.eventType === "wedding" ||
    input.eventType === "engagement" ||
    input.eventType === "sangeet" ||
    input.eventType === "haldi" ||
    input.eventType === "mehendi" ||
    input.eventType === "reception";

  const primary = isCouple
    ? bride || celebrant || family || host || name || ""
    : celebrant || family || host || name || bride || "";
  const secondary = isCouple ? groom || "" : groom;
  const date = isDateValue(fields.eventDate) ? formatDate(fields.eventDate, "weekday") : "";
  const time = formatTimeRange(
    isTimeValue(fields.eventTime) ? fields.eventTime : null,
    isTimeValue(fields.eventEndTime) ? fields.eventEndTime : null,
  );
  const city = [text(fields, "city"), text(fields, "state")].filter(Boolean).join(", ");
  const address = text(fields, "venueAddress");
  const maps = text(fields, "locationUrl");
  const profileUrl = text(fields, "profileUrl") || text(fields, "website") || text(fields, "linkedin");
  const qrUrl = maps || profileUrl || "";
  const message = text(fields, "invitationMessage") || "";

  const facts = [
    text(fields, "age") && `Age ${text(fields, "age")}`,
    text(fields, "gender"),
    text(fields, "height"),
    text(fields, "religion"),
    text(fields, "highestEducation") || text(fields, "education"),
    text(fields, "occupation") || text(fields, "profession") || text(fields, "expertise"),
    text(fields, "location"),
    text(fields, "languages"),
  ]
    .filter(Boolean)
    .join("  ·  ");

  const brideParents = text(fields, "brideParents");
  const groomParents = text(fields, "groomParents");
  const fatherName = text(fields, "fatherName");
  const motherName = text(fields, "motherName");
  const parentsFromBio = [fatherName, motherName].filter(Boolean).join(" & ");
  const parentsLine =
    [brideParents, groomParents].filter(Boolean).join("  ·  ") || text(fields, "parents") || parentsFromBio;

  const dressCode = text(fields, "dressCode");
  const hosts = text(fields, "hosts");
  const rsvpPhone = text(fields, "rsvpPhone");
  const rsvpNote = text(fields, "rsvpNote");
  const gifts = text(fields, "gifts");
  const hashtag = text(fields, "hashtag").replace(/^#/, "");

  const detailExtras = [
    hosts && `Hosted by ${hosts}`,
    dressCode && `Dress · ${dressCode}`,
    rsvpPhone && `RSVP ${rsvpPhone}`,
    rsvpNote,
    gifts,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const educationLine = [
    text(fields, "degree") || text(fields, "highestEducation") || text(fields, "education"),
    text(fields, "institution"),
    text(fields, "graduationYear") || text(fields, "fieldOfStudy"),
  ]
    .filter(Boolean)
    .join(", ");

  const occupationLine = [
    text(fields, "occupation") || text(fields, "profession") || job,
    company,
    text(fields, "incomeRange"),
  ]
    .filter(Boolean)
    .join(", ");

  const familyLine = [
    fatherName && `Father · ${fatherName}`,
    motherName && `Mother · ${motherName}`,
    text(fields, "siblings") && `Siblings · ${text(fields, "siblings")}`,
    text(fields, "familyType") && `Family · ${text(fields, "familyType")}`,
    !fatherName && !motherName && text(fields, "parents") && `Parents · ${text(fields, "parents")}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const personalLine = [
    text(fields, "dateOfBirth") || text(fields, "age"),
    text(fields, "height"),
    text(fields, "rashi"),
    text(fields, "location") || text(fields, "placeOfBirth"),
  ]
    .filter(Boolean)
    .join("  ·  ");

  const lifestyleLine = [text(fields, "interests"), text(fields, "hobbies")].filter(Boolean).join("  ·  ");

  const expectations = text(fields, "expectations");
  const phone = text(fields, "phone");
  const email = text(fields, "email");
  const preferredContact = text(fields, "preferredContact");
  const contactPerson = text(fields, "contactPerson");
  const residentialAddress =
    text(fields, "residentialAddress") ||
    [text(fields, "venueAddress"), text(fields, "location"), text(fields, "city")].filter(Boolean).join(", ");

  const degreeLabel = text(fields, "degree") || text(fields, "highestEducation") || text(fields, "education");
  const bachelorsLine = [text(fields, "institution"), text(fields, "graduationYear"), degreeLabel ? `(${degreeLabel})` : ""]
    .filter(Boolean)
    .join(", ");

  const workLine = [text(fields, "occupation") || text(fields, "profession") || job, company].filter(Boolean).join(", ");

  // Classic biodata sheet blocks — Label : value rows (Composition preserves newlines).
  const biodataPersonalRows = biodataRows([
    ["Name", name || primary],
    ["Date of Birth", text(fields, "dateOfBirth") || text(fields, "age")],
    ["Time of Birth", text(fields, "timeOfBirth")],
    ["Place of Birth", text(fields, "placeOfBirth")],
    ["Rashi", text(fields, "rashi")],
    ["Nakshatra", text(fields, "nakshatra")],
    ["Complexion", text(fields, "complexion")],
    ["Height", text(fields, "height")],
    ["Gotra", text(fields, "gotra") || text(fields, "religion")],
    ["Bachelors", bachelorsLine || educationLine],
    ["Work", workLine || occupationLine],
  ]);

  const biodataFamilyRows = biodataRows([
    ["Father's Name", fatherName],
    ["Father's Occupation", text(fields, "fatherOccupation")],
    ["Mother's Name", motherName],
    ["Mother's Occupation", text(fields, "motherOccupation")],
    ["Siblings", text(fields, "siblings")],
  ]);

  const biodataContactRows = biodataRows([
    ["Contact Person", contactPerson || fatherName],
    ["Contact Number", phone],
    ["Email ID", email || text(fields, "contact")],
    ["Residential Address", residentialAddress],
  ]);

  const biodataNotesRows = biodataRows(
    [
      ["About me", text(fields, "about")],
      ["Expectations", expectations],
    ],
    14,
  );

  const cardExtras = [
    familyLine,
    lifestyleLine,
    expectations && `Looking for · ${expectations}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const contactLine = [
    phone,
    email || text(fields, "contact"),
    preferredContact && `Prefer ${preferredContact}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  // Legacy section blocks (older bio layouts)
  const bioPersonalBlock = personalLine ? `Personal  ·  ${personalLine}` : "";
  const bioFamilyBlock = familyLine ? `Family  ·  ${familyLine}` : "";
  const bioEducationBlock = educationLine ? `Education  ·  ${educationLine}` : "";
  const bioOccupationBlock = occupationLine ? `Work  ·  ${occupationLine}` : "";
  const bioLifestyleBlock = lifestyleLine ? `Interests  ·  ${lifestyleLine}` : "";
  const bioExpectationsBlock = expectations ? `Expectations  ·  ${expectations}` : "";

  const resolved: Record<string, string> = {
    ...stringFields(fields),
    invitationMessage: guestName ? `Dear ${guestName}, ${message}` : message,
    // Canonical composition keys — always win over raw form keys.
    brideName: bride,
    groomName: groom,
    primaryName: primary,
    secondaryName: secondary,
    ampersand: secondary ? "&" : "",
    formattedDate: date,
    formattedTime: time,
    venueName: text(fields, "venueName") || title,
    cityLine: [address, city].filter(Boolean).join(" · "),
    qrUrl,
    coverImage: text(fields, "coverImage"),
    photo: text(fields, "photo") || text(fields, "coverImage"),
    photo2: text(fields, "photo2") || text(fields, "coverImage"),
    photo3: text(fields, "photo3") || text(fields, "photo2") || text(fields, "coverImage"),
    photo4:
      text(fields, "photo4") ||
      text(fields, "photo3") ||
      text(fields, "photo2") ||
      text(fields, "coverImage"),
    fullName: name || primary,
    roleLine: occupationLine || [job || text(fields, "profession"), company].filter(Boolean).join(" · "),
    factLine: facts || personalLine,
    about: text(fields, "about"),
    contactLine,
    parentsLine,
    brideParents,
    groomParents,
    detailExtras,
    extraNote: text(fields, "additionalNote"),
    hashtagLine: hashtag ? `#${hashtag}` : "",
    cardExtras,
    personalLine,
    familyLine,
    educationLine,
    occupationLine,
    lifestyleLine,
    bioPersonalBlock,
    bioFamilyBlock,
    bioEducationBlock,
    bioOccupationBlock,
    bioLifestyleBlock,
    bioExpectationsBlock,
    expectations,
    biodataPersonalRows,
    biodataFamilyRows,
    biodataContactRows,
    biodataNotesRows,
  };

  return resolved;
}

export function defaultFields(template: TemplateDefinition, input: Partial<RenderInput> = {}): Record<string, unknown> {
  const eventType = input.eventType;
  const messages = messagesFor(eventType);
  const base: Record<string, unknown> = {
    invitationMessage: messages[0],
    eventDate: { day: 14, month: 12, year: 2026 },
    eventTime: { hour: 18, minute: 30, format: "12h" },
    timezone: "Asia/Kolkata",
    venueName: "The Leela Palace",
    venueAddress: "Road No. 1, Banjara Hills",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    locationUrl: "https://maps.google.com/?q=The+Leela+Palace+Hyderabad",
  };

  if (template.kind === "card") {
    if (isBioCardType(input.cardType) || template.cardTypes?.includes("bio")) {
      return {
        fullName: "Mahima Singh",
        dateOfBirth: "20 November 1995",
        timeOfBirth: "7:20 PM",
        placeOfBirth: "New Delhi",
        rashi: "Mesh (Aries)",
        nakshatra: "Chitra",
        complexion: "Fair",
        height: "5 feet 9 inches",
        gotra: "Singh",
        degree: "B.COM Hons",
        institution: "Delhi University",
        graduationYear: "2018",
        occupation: "Senior Consultant",
        company: "BCG",
        fatherName: "Sh. Deepak Singh",
        fatherOccupation: "Business (Motor Parts Trading)",
        motherName: "Smt. Madhu Singh",
        motherOccupation: "Homemaker",
        siblings: "1 Brother (Unmarried)",
        contactPerson: "Sh. Deepak Singh",
        phone: "+91 1129921929",
        email: "mahima.singh@mail.com",
        residentialAddress: "M-Block, House No 23, Greater Kailash (Self Owned)",
        about: "",
        expectations: "",
      };
    }
    return {
      fullName: template.cardTypes?.includes("conference-speaker") ? "Dr Meera Shah" : "Ananya Iyer",
      jobTitle: "Keynote Speaker",
      company: "Open Studio",
      age: "28",
      height: "5'5\"",
      education: "M.Des, NID",
      profession: "Product Designer",
      location: "Bengaluru",
      languages: "English, Tamil, Hindi",
      parents: "Dr S. Iyer & Mrs Lata Iyer",
      about: "I love building thoughtful things, long walks, and Carnatic mornings.",
      contact: "hello@example.com",
      expertise: "Design systems · Public speaking",
      profileUrl: "https://example.com",
    };
  }

  if (eventType === "birthday") {
    return { ...base, celebrantName: "Aanya", age: "5", venueName: "Home Garden" };
  }
  if (eventType === "gruha-pravesham" || eventType === "housewarming") {
    return { ...base, familyName: "The Reddy Family", eventTitle: "Gruha Pravesham" };
  }
  if (eventType === "wedding" || eventType === "engagement" || eventType === "sangeet" || eventType === "haldi" || eventType === "mehendi" || eventType === "reception") {
    return { ...base, brideName: "Priya", groomName: "Rahul" };
  }
  return { ...base, hostNames: "The Kapoor Family", eventTitle: "Celebration" };
}

/** Empty starting fields for a new draft — only the current year is prefilled for invitations. */
export function blankFields(template: TemplateDefinition, _input: Partial<RenderInput> = {}): Record<string, unknown> {
  if (template.kind === "card") return {};
  return {
    eventDate: { year: new Date().getFullYear() },
  };
}

export function displayTitle(input: RenderInput): string {
  const fields = input.fields;
  const bride = text(fields, "brideName");
  const groom = text(fields, "groomName");
  if (bride && groom) return `${bride} & ${groom}`;
  return text(fields, "celebrantName") || text(fields, "familyName") || text(fields, "hostNames") || text(fields, "fullName") || "Untitled";
}

export function mergedColors(template: TemplateDefinition, theme?: RenderInput["theme"]): Record<string, string> {
  return { ...template.colors, ...themeOverlay(theme) };
}
