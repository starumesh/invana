export type EventTypeId =
  | "wedding"
  | "engagement"
  | "birthday"
  | "gruha-pravesham"
  | "sangeet"
  | "haldi"
  | "baby-shower"
  | "anniversary"
  | "reception"
  | "housewarming"
  | "naming-ceremony"
  | "mehendi"
  | "save-the-date"
  | "party"
  | "custom";

export type CardTypeId =
  | "bio"
  | "dating-bio"
  | "personal-intro"
  | "conference-speaker"
  | "seminar-speaker"
  | "professional"
  | "birthday-profile"
  | "family-intro"
  | "event-host"
  | "custom-card";

export type DateValue = {
  day: number;
  month: number;
  year: number;
};

export type TimeValue = {
  hour: number;
  minute: number;
  format: "12h" | "24h";
};

export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "time"
  | "url"
  | "image"
  | "select"
  | "message"
  | "phone"
  | "email"
  | "number";

export type FieldSpec = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  group?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  maxLength?: number;
};

export type ElementType =
  | "rect"
  | "text"
  | "image"
  | "qr"
  | "line"
  | "circle"
  | "motif"
  | "frame"
  | "decor";

export type MotifKind =
  | "floral"
  | "diamond"
  | "lamp"
  | "mandala"
  | "dots"
  | "border"
  | "sun"
  | "lotus"
  | "paisley"
  | "om"
  | "ganesh"
  | "swastik"
  | "krishna"
  | "cross"
  | "crescent";

/** Full decorative compositions — edges, florals, lace — not just color accents. */
export type DecorKind =
  | "floral-vine-top"
  | "floral-vine-bottom"
  | "scallop-frame"
  | "corner-flourish"
  | "side-vine"
  | "lace-corners"
  | "arch-top"
  | "leaf-spray"
  | "mehendi-band"
  | "peacock-fan"
  | "garland-top"
  | "ornate-corners"
  | "floral-corners"
  | "section-ornament";

export type ElementSpec = {
  id: string;
  type: ElementType;
  field?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  letterSpacing?: number;
  lineHeight?: number;
  textAnchor?: "start" | "middle" | "end";
  textTransform?: "none" | "uppercase";
  maxLines?: number;
  motif?: MotifKind;
  decor?: DecorKind;
  staticText?: string;
  rx?: number;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  kind: "invitation" | "card";
  eventTypes: EventTypeId[];
  cardTypes?: CardTypeId[];
  category: string;
  tags: string[];
  orientation: "portrait" | "landscape" | "square";
  dimensions: {
    width: number;
    height: number;
    unit: "px";
    printWidth: number;
    printHeight: number;
    printUnit: "in" | "mm";
  };
  background: { type: "solid" | "gradient"; colors: string[] };
  fonts: { heading: string; body: string; accent?: string };
  colors: Record<string, string>;
  fields: FieldSpec[];
  elements: ElementSpec[];
  previewHint: string;
  license: {
    source: string;
    license: string;
    commercialUseAllowed: boolean;
  };
};

export type ThemeId = "classic" | "elegant" | "royal" | "modern" | "minimal" | "festive";

export type RenderInput = {
  schemaVersion: 1;
  kind: "invitation" | "card";
  eventType?: EventTypeId;
  cardType?: CardTypeId;
  templateId: string;
  fields: Record<string, unknown>;
  theme?: ThemeId;
  sections?: Record<string, boolean>;
};

export type StoredEvent = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  config: RenderInput;
  createdAt: string;
  updatedAt: string;
};

export type RsvpResponse = "yes" | "no" | "maybe";

export type Rsvp = {
  id: string;
  eventId: string;
  guestName: string;
  response: RsvpResponse;
  partySize: number;
  phone?: string;
  email?: string;
  dietary?: string;
  message?: string;
  createdAt: string;
};

export type DemoUser = {
  id: string;
  email: string;
  name: string;
};

export type SendResult = {
  recipient: string;
  status: "pending" | "sent" | "failed" | "demo";
  error?: string;
  url?: string;
};
