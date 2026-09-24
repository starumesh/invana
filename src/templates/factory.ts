import type { CardTypeId, ElementSpec, EventTypeId, MotifKind, TemplateDefinition } from "@/types";
import { cardFields, invitationFields } from "@/templates/fields";

export type Palette = {
  paper: string;
  ink: string;
  accent: string;
  muted: string;
  line: string;
};

export type InviteLayout =
  | "classic"
  | "photo"
  | "dark"
  | "split"
  | "centered"
  | "festive"
  | "traditional"
  | "banner"
  | "royal"
  | "cultural"
  | "floral-edge"
  | "lace"
  | "arch"
  | "vine"
  | "mehendi"
  | "garland"
  | "photo-spaced"
  | "collage-duo"
  | "collage-trio"
  | "collage-grid"
  | "collage-polaroid";

export type CardLayout =
  | "portrait"
  | "split"
  | "folio"
  | "circle"
  | "bio-spaced"
  | "bio-editorial"
  | "bio-split"
  | "biodata-classic"
  | "biodata-sidebar"
  | "biodata-columns"
  | "biodata-modern"
  | "biodata-arch"
  | "biodata-garland"
  | "biodata-gold"
  | "biodata-compact";

const LICENSE = {
  source: "Original Invana composition",
  license: "All rights reserved — original artwork and layout",
  commercialUseAllowed: true,
} as const;

const PORTRAIT = {
  width: 1080,
  height: 1512,
  unit: "px" as const,
  printWidth: 5,
  printHeight: 7,
  printUnit: "in" as const,
};

function parentsElement(
  opts: { body: string; x?: number; y: number; width?: number; anchor?: "start" | "middle" | "end" },
): ElementSpec {
  return {
    id: "parents",
    type: "text" as const,
    field: "parentsLine",
    x: opts.x ?? 540,
    y: opts.y,
    width: opts.width ?? 820,
    fontFamily: opts.body,
    fontSize: 16,
    fill: "muted",
    textAnchor: opts.anchor ?? "middle",
    maxLines: 2,
  };
}

function inviteExtras(y: number, body: string): ElementSpec[] {
  return [
    {
      id: "detail-extras",
      type: "text" as const,
      field: "detailExtras",
      x: 540,
      y,
      width: 820,
      fontFamily: body,
      fontSize: 16,
      fill: "muted",
      textAnchor: "middle" as const,
      maxLines: 2,
    },
    {
      id: "extra-note",
      type: "text" as const,
      field: "extraNote",
      x: 540,
      y: y + 36,
      width: 780,
      fontFamily: body,
      fontSize: 15,
      fill: "muted",
      textAnchor: "middle" as const,
      maxLines: 2,
    },
    {
      id: "hashtag",
      type: "text" as const,
      field: "hashtagLine",
      x: 540,
      y: y + 72,
      width: 600,
      fontFamily: body,
      fontSize: 16,
      fill: "accent",
      textAnchor: "middle" as const,
      letterSpacing: 1.2,
    },
  ];
}

function classicElements(opts: {
  heading: string;
  body: string;
  accent?: string;
  motif: MotifKind;
  hasPhoto: boolean;
}): ElementSpec[] {
  const hasPhoto = opts.hasPhoto;
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "frame", type: "frame" as const, x: 48, y: 48, width: 984, height: 1416, stroke: "line", strokeWidth: 1.5 },
    { id: "motif-top", type: "motif" as const, motif: opts.motif, x: 540, y: hasPhoto ? 430 : 150, width: 220, height: 70, fill: "accent" },
    ...(hasPhoto
      ? [{ id: "photo", type: "image" as const, field: "coverImage", x: 180, y: 90, width: 720, height: 300, rx: 4 }]
      : []),
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: hasPhoto ? 520 : 280, width: 780, fontFamily: opts.body, fontSize: 22, fill: "muted", textAnchor: "middle" as const, maxLines: 3, letterSpacing: 0.4 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: hasPhoto ? 660 : 440, width: 860, fontFamily: opts.heading, fontSize: 72, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: hasPhoto ? 760 : 540, width: 200, fontFamily: opts.accent ?? opts.heading, fontSize: 40, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: hasPhoto ? 840 : 640, width: 860, fontFamily: opts.heading, fontSize: 72, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: hasPhoto ? 910 : 720 }),
    { id: "line", type: "line" as const, x: 360, y: hasPhoto ? 960 : 780, width: 360, stroke: "line", strokeWidth: 1 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: hasPhoto ? 1020 : 860, width: 800, fontFamily: opts.body, fontSize: 26, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.5, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: hasPhoto ? 1064 : 904, width: 800, fontFamily: opts.body, fontSize: 22, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: hasPhoto ? 1130 : 990, width: 820, fontFamily: opts.heading, fontSize: 32, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: hasPhoto ? 1180 : 1044, width: 820, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(hasPhoto ? 1220 : 1100, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 478, y: 1320, width: 100, height: 100 },
    { id: "qr-label", type: "text" as const, staticText: "Scan for directions", x: 540, y: 1450, width: 400, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, letterSpacing: 1.8, textTransform: "uppercase" as const },
  ];
}

function darkElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "accent-bar", type: "rect" as const, x: 0, y: 0, width: 1080, height: 18, fill: "accent" },
    { id: "inner", type: "frame" as const, x: 64, y: 64, width: 952, height: 1384, stroke: "line", strokeWidth: 1 },
    { id: "motif-top", type: "motif" as const, motif: opts.motif, x: 540, y: 180, width: 260, height: 80, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 300, width: 780, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const, maxLines: 3, letterSpacing: 1.2, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 460, width: 880, fontFamily: opts.heading, fontSize: 80, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 560, width: 200, fontFamily: opts.accent ?? opts.heading, fontSize: 44, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 660, width: 880, fontFamily: opts.heading, fontSize: 80, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 750 }),
    { id: "diamond", type: "motif" as const, motif: "diamond", x: 540, y: 820, width: 160, height: 40, fill: "accent" },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 900, width: 800, fontFamily: opts.body, fontSize: 28, fill: "ink", textAnchor: "middle" as const, letterSpacing: 2, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 950, width: 800, fontFamily: opts.body, fontSize: 22, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1040, width: 820, fontFamily: opts.heading, fontSize: 34, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1090, width: 820, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1140, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 478, y: 1320, width: 100, height: 100 },
    { id: "qr-label", type: "text" as const, staticText: "Join the celebration", x: 540, y: 1450, width: 400, fontFamily: opts.body, fontSize: 13, fill: "muted", textAnchor: "middle" as const, letterSpacing: 2, textTransform: "uppercase" as const },
  ];
}

function splitElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "photo-panel", type: "rect" as const, x: 0, y: 0, width: 480, height: 1512, fill: "line" },
    { id: "photo", type: "image" as const, field: "coverImage", x: 0, y: 0, width: 480, height: 1512, rx: 0 },
    { id: "accent-strip", type: "rect" as const, x: 480, y: 0, width: 8, height: 1512, fill: "accent" },
    { id: "motif-top", type: "motif" as const, motif: opts.motif, x: 780, y: 140, width: 180, height: 50, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 780, y: 240, width: 480, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const, maxLines: 4 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 780, y: 400, width: 500, fontFamily: opts.heading, fontSize: 48, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 780, y: 470, width: 120, fontFamily: opts.accent ?? opts.heading, fontSize: 34, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 780, y: 540, width: 500, fontFamily: opts.heading, fontSize: 48, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, x: 780, y: 610, width: 460 }),
    { id: "line", type: "line" as const, x: 640, y: 660, width: 280, stroke: "line", strokeWidth: 1 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 780, y: 720, width: 480, fontFamily: opts.body, fontSize: 20, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.2, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 780, y: 760, width: 480, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 780, y: 860, width: 480, fontFamily: opts.heading, fontSize: 26, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 780, y: 920, width: 480, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const, maxLines: 3 },
    { id: "detail-extras", type: "text" as const, field: "detailExtras", x: 780, y: 1020, width: 460, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, maxLines: 3 },
    { id: "extra-note", type: "text" as const, field: "extraNote", x: 780, y: 1100, width: 460, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "hashtag", type: "text" as const, field: "hashtagLine", x: 780, y: 1160, width: 400, fontFamily: opts.body, fontSize: 14, fill: "accent", textAnchor: "middle" as const },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 730, y: 1240, width: 100, height: 100 },
    { id: "qr-label", type: "text" as const, staticText: "Directions", x: 780, y: 1380, width: 200, fontFamily: opts.body, fontSize: 12, fill: "muted", textAnchor: "middle" as const, letterSpacing: 1.5, textTransform: "uppercase" as const },
  ];
}

function centeredElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "outer", type: "frame" as const, x: 72, y: 72, width: 936, height: 1368, stroke: "line", strokeWidth: 1 },
    { id: "inner", type: "frame" as const, x: 96, y: 96, width: 888, height: 1320, stroke: "accent", strokeWidth: 0.8, opacity: 0.55 },
    { id: "motif-top", type: "motif" as const, motif: opts.motif, x: 540, y: 220, width: 200, height: 60, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 340, width: 700, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 3, letterSpacing: 2, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 480, width: 820, fontFamily: opts.heading, fontSize: 68, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 580, width: 120, fontFamily: opts.accent ?? opts.heading, fontSize: 38, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 670, width: 820, fontFamily: opts.heading, fontSize: 68, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 760 }),
    { id: "line", type: "line" as const, x: 400, y: 820, width: 280, stroke: "line", strokeWidth: 1 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 900, width: 720, fontFamily: opts.body, fontSize: 24, fill: "ink", textAnchor: "middle" as const, letterSpacing: 2, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 950, width: 720, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1050, width: 760, fontFamily: opts.heading, fontSize: 30, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1100, width: 760, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1160, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1320, width: 100, height: 100 },
  ];
}

function festiveElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "top-band", type: "rect" as const, x: 0, y: 0, width: 1080, height: 160, fill: "accent", opacity: 0.18 },
    { id: "bottom-band", type: "rect" as const, x: 0, y: 1352, width: 1080, height: 160, fill: "accent", opacity: 0.18 },
    { id: "dot-tl", type: "motif" as const, motif: "dots", x: 160, y: 80, width: 120, height: 30, fill: "accent" },
    { id: "dot-tr", type: "motif" as const, motif: "dots", x: 920, y: 80, width: 120, height: 30, fill: "accent" },
    { id: "motif-top", type: "motif" as const, motif: opts.motif, x: 540, y: 200, width: 240, height: 70, fill: "accent" },
    { id: "photo", type: "image" as const, field: "coverImage", x: 270, y: 260, width: 540, height: 320, rx: 24 },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 620, width: 780, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 720, width: 900, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 800, width: 160, fontFamily: opts.accent ?? opts.heading, fontSize: 34, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 870, width: 900, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 940 }),
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1010, width: 800, fontFamily: opts.body, fontSize: 24, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.5, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 1050, width: 800, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1120, width: 820, fontFamily: opts.heading, fontSize: 28, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1164, width: 820, fontFamily: opts.body, fontSize: 17, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "detail-extras", type: "text" as const, field: "detailExtras", x: 540, y: 1210, width: 800, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "hashtag", type: "text" as const, field: "hashtagLine", x: 540, y: 1255, width: 600, fontFamily: opts.body, fontSize: 16, fill: "accent", textAnchor: "middle" as const },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1300, width: 100, height: 100 },
  ];
}

function traditionalElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "frame", type: "frame" as const, x: 40, y: 40, width: 1000, height: 1432, stroke: "accent", strokeWidth: 2 },
    { id: "frame-inner", type: "frame" as const, x: 64, y: 64, width: 952, height: 1384, stroke: "line", strokeWidth: 1 },
    { id: "mandala-top", type: "motif" as const, motif: "mandala", x: 540, y: 160, width: 120, height: 120, fill: "accent" },
    { id: "lamp-l", type: "motif" as const, motif: "lamp", x: 200, y: 280, width: 80, height: 60, fill: "accent" },
    { id: "lamp-r", type: "motif" as const, motif: "lamp", x: 880, y: 280, width: 80, height: 60, fill: "accent" },
    { id: "motif-mid", type: "motif" as const, motif: opts.motif, x: 540, y: 280, width: 200, height: 50, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 380, width: 780, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const, maxLines: 3 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 500, width: 860, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 590, width: 160, fontFamily: opts.accent ?? opts.heading, fontSize: 38, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 680, width: 860, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 770 }),
    { id: "line", type: "line" as const, x: 360, y: 830, width: 360, stroke: "accent", strokeWidth: 1.2 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 910, width: 800, fontFamily: opts.body, fontSize: 24, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.5, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 958, width: 800, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1050, width: 820, fontFamily: opts.heading, fontSize: 30, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1100, width: 820, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1150, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1330, width: 100, height: 100 },
  ];
}

function bannerElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "frame", type: "frame" as const, x: 48, y: 48, width: 984, height: 1416, stroke: "line", strokeWidth: 1.2 },
    { id: "motif-top", type: "motif" as const, motif: opts.motif, x: 540, y: 130, width: 200, height: 50, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 220, width: 780, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 2, letterSpacing: 1.5, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 320, width: 860, fontFamily: opts.heading, fontSize: 60, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 400, width: 120, fontFamily: opts.accent ?? opts.heading, fontSize: 32, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 470, width: 860, fontFamily: opts.heading, fontSize: 60, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 535 }),
    { id: "photo", type: "image" as const, field: "coverImage", x: 120, y: 570, width: 840, height: 340, rx: 8 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 980, width: 800, fontFamily: opts.body, fontSize: 24, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.5, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 1024, width: 800, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1100, width: 820, fontFamily: opts.heading, fontSize: 28, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1150, width: 820, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1200, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1330, width: 100, height: 100 },
  ];
}

function royalElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "outer", type: "frame" as const, x: 36, y: 36, width: 1008, height: 1440, stroke: "accent", strokeWidth: 2.5 },
    { id: "mid", type: "frame" as const, x: 56, y: 56, width: 968, height: 1400, stroke: "line", strokeWidth: 1 },
    { id: "inner", type: "frame" as const, x: 84, y: 84, width: 912, height: 1344, stroke: "accent", strokeWidth: 0.8, opacity: 0.45 },
    { id: "ornate", type: "decor" as const, decor: "ornate-corners", x: 48, y: 48, width: 984, height: 1416, fill: "accent" },
    { id: "c-tl", type: "motif" as const, motif: opts.motif, x: 140, y: 140, width: 90, height: 90, fill: "accent" },
    { id: "c-tr", type: "motif" as const, motif: opts.motif, x: 940, y: 140, width: 90, height: 90, fill: "accent" },
    { id: "c-bl", type: "motif" as const, motif: opts.motif, x: 140, y: 1370, width: 90, height: 90, fill: "accent" },
    { id: "c-br", type: "motif" as const, motif: opts.motif, x: 940, y: 1370, width: 90, height: 90, fill: "accent" },
    { id: "crest", type: "motif" as const, motif: "diamond", x: 540, y: 200, width: 220, height: 70, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 300, width: 720, fontFamily: opts.body, fontSize: 17, fill: "muted", textAnchor: "middle" as const, maxLines: 3, letterSpacing: 2.2, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 440, width: 820, fontFamily: opts.heading, fontSize: 74, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 545, width: 140, fontFamily: opts.accent ?? opts.heading, fontSize: 42, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 650, width: 820, fontFamily: opts.heading, fontSize: 74, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 740 }),
    { id: "ornament", type: "motif" as const, motif: "diamond", x: 540, y: 810, width: 180, height: 40, fill: "accent" },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 890, width: 760, fontFamily: opts.body, fontSize: 26, fill: "ink", textAnchor: "middle" as const, letterSpacing: 2.4, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 940, width: 760, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1030, width: 780, fontFamily: opts.heading, fontSize: 32, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1085, width: 780, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1145, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1310, width: 100, height: 100 },
  ];
}

function culturalElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "left-band", type: "rect" as const, x: 0, y: 0, width: 48, height: 1512, fill: "accent", opacity: 0.85 },
    { id: "right-band", type: "rect" as const, x: 1032, y: 0, width: 48, height: 1512, fill: "accent", opacity: 0.85 },
    { id: "top-band", type: "rect" as const, x: 48, y: 0, width: 984, height: 28, fill: "accent", opacity: 0.55 },
    { id: "bottom-band", type: "rect" as const, x: 48, y: 1484, width: 984, height: 28, fill: "accent", opacity: 0.55 },
    { id: "frame", type: "frame" as const, x: 72, y: 72, width: 936, height: 1368, stroke: "line", strokeWidth: 1.2 },
    { id: "motif-top", type: "motif" as const, motif: opts.motif, x: 540, y: 160, width: 160, height: 80, fill: "accent" },
    { id: "side-l", type: "motif" as const, motif: "paisley", x: 160, y: 320, width: 70, height: 90, fill: "accent" },
    { id: "side-r", type: "motif" as const, motif: "paisley", x: 920, y: 320, width: 70, height: 90, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 280, width: 720, fontFamily: opts.body, fontSize: 19, fill: "muted", textAnchor: "middle" as const, maxLines: 3 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 430, width: 800, fontFamily: opts.heading, fontSize: 66, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 525, width: 140, fontFamily: opts.accent ?? opts.heading, fontSize: 36, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 620, width: 800, fontFamily: opts.heading, fontSize: 66, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 710 }),
    { id: "photo", type: "image" as const, field: "coverImage", x: 220, y: 760, width: 640, height: 260, rx: 6 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1080, width: 760, fontFamily: opts.body, fontSize: 22, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.6, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 1120, width: 760, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1185, width: 760, fontFamily: opts.heading, fontSize: 28, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1230, width: 760, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "detail-extras", type: "text" as const, field: "detailExtras", x: 540, y: 1275, width: 720, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1335, width: 100, height: 100 },
  ];
}

function floralEdgeElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "vine-top", type: "decor" as const, decor: "floral-vine-top", x: 80, y: 40, width: 920, height: 110, fill: "accent" },
    { id: "vine-bottom", type: "decor" as const, decor: "floral-vine-bottom", x: 80, y: 1360, width: 920, height: 110, fill: "accent" },
    { id: "corners", type: "decor" as const, decor: "corner-flourish", x: 48, y: 160, width: 984, height: 1180, fill: "accent" },
    { id: "spray", type: "decor" as const, decor: "leaf-spray", x: 540, y: 200, width: 120, height: 80, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 300, width: 760, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 3 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 430, width: 820, fontFamily: opts.heading, fontSize: 68, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 530, width: 140, fontFamily: opts.accent ?? opts.heading, fontSize: 38, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 630, width: 820, fontFamily: opts.heading, fontSize: 68, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 720 }),
    { id: "motif-mid", type: "motif" as const, motif: opts.motif, x: 540, y: 790, width: 180, height: 50, fill: "accent" },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 870, width: 760, fontFamily: opts.body, fontSize: 24, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.8, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 920, width: 760, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1010, width: 780, fontFamily: opts.heading, fontSize: 30, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1060, width: 780, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1120, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1280, width: 100, height: 100 },
  ];
}

function laceElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "scallop", type: "decor" as const, decor: "scallop-frame", x: 40, y: 40, width: 1000, height: 1432, fill: "accent" },
    { id: "lace", type: "decor" as const, decor: "lace-corners", x: 70, y: 70, width: 940, height: 1372, fill: "accent" },
    { id: "ornate", type: "decor" as const, decor: "ornate-corners", x: 100, y: 100, width: 880, height: 1312, fill: "line" },
    { id: "motif-top", type: "motif" as const, motif: opts.motif, x: 540, y: 220, width: 160, height: 60, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 320, width: 700, fontFamily: opts.body, fontSize: 17, fill: "muted", textAnchor: "middle" as const, maxLines: 3, letterSpacing: 1.5, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 450, width: 780, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 550, width: 120, fontFamily: opts.accent ?? opts.heading, fontSize: 36, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 650, width: 780, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 740 }),
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 860, width: 720, fontFamily: opts.body, fontSize: 22, fill: "ink", textAnchor: "middle" as const, letterSpacing: 2, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 910, width: 720, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1000, width: 740, fontFamily: opts.heading, fontSize: 28, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1050, width: 740, fontFamily: opts.body, fontSize: 17, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1110, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1300, width: 100, height: 100 },
  ];
}

function archElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "arch", type: "decor" as const, decor: "arch-top", x: 120, y: 60, width: 840, height: 420, fill: "accent" },
    { id: "corners", type: "decor" as const, decor: "ornate-corners", x: 48, y: 48, width: 984, height: 1416, fill: "line" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 360, width: 640, fontFamily: opts.body, fontSize: 17, fill: "muted", textAnchor: "middle" as const, maxLines: 2, letterSpacing: 1.8, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 500, width: 780, fontFamily: opts.heading, fontSize: 66, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 595, width: 120, fontFamily: opts.accent ?? opts.heading, fontSize: 36, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 690, width: 780, fontFamily: opts.heading, fontSize: 66, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 775 }),
    { id: "photo", type: "image" as const, field: "coverImage", x: 240, y: 820, width: 600, height: 240, rx: 8 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1120, width: 760, fontFamily: opts.body, fontSize: 22, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.6, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 1165, width: 760, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1230, width: 760, fontFamily: opts.heading, fontSize: 28, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1275, width: 760, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1335, width: 100, height: 100 },
  ];
}

function vineElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "vines", type: "decor" as const, decor: "side-vine", x: 36, y: 80, width: 1008, height: 1350, fill: "accent" },
    { id: "spray-top", type: "decor" as const, decor: "leaf-spray", x: 540, y: 140, width: 100, height: 70, fill: "accent" },
    { id: "frame", type: "frame" as const, x: 120, y: 100, width: 840, height: 1312, stroke: "line", strokeWidth: 1 },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 260, width: 680, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 3 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 400, width: 720, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 500, width: 120, fontFamily: opts.accent ?? opts.heading, fontSize: 34, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 600, width: 720, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 690 }),
    { id: "motif-mid", type: "motif" as const, motif: opts.motif, x: 540, y: 760, width: 160, height: 45, fill: "accent" },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 850, width: 680, fontFamily: opts.body, fontSize: 22, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.6, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 900, width: 680, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 990, width: 700, fontFamily: opts.heading, fontSize: 28, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1040, width: 700, fontFamily: opts.body, fontSize: 17, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1100, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1300, width: 100, height: 100 },
  ];
}

function mehendiElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "band-top", type: "decor" as const, decor: "mehendi-band", x: 80, y: 50, width: 920, height: 70, fill: "accent" },
    { id: "band-mid", type: "decor" as const, decor: "mehendi-band", x: 140, y: 780, width: 800, height: 56, fill: "accent" },
    { id: "band-bot", type: "decor" as const, decor: "mehendi-band", x: 80, y: 1390, width: 920, height: 70, fill: "accent" },
    { id: "fan", type: "decor" as const, decor: "peacock-fan", x: 540, y: 200, width: 160, height: 100, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 320, width: 760, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 3 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 450, width: 820, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 545, width: 120, fontFamily: opts.accent ?? opts.heading, fontSize: 34, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 640, width: 820, fontFamily: opts.heading, fontSize: 64, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 720 }),
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 900, width: 760, fontFamily: opts.body, fontSize: 22, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.6, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 950, width: 760, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1040, width: 760, fontFamily: opts.heading, fontSize: 28, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1090, width: 760, fontFamily: opts.body, fontSize: 17, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    ...inviteExtras(1145, opts.body),
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1290, width: 100, height: 100 },
  ];
}

function garlandElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "garland", type: "decor" as const, decor: "garland-top", x: 100, y: 40, width: 880, height: 140, fill: "accent" },
    { id: "flourish", type: "decor" as const, decor: "corner-flourish", x: 56, y: 180, width: 968, height: 1160, fill: "accent" },
    { id: "spray", type: "decor" as const, decor: "leaf-spray", x: 540, y: 220, width: 100, height: 70, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 320, width: 740, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 3 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 450, width: 800, fontFamily: opts.heading, fontSize: 66, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 550, width: 120, fontFamily: opts.accent ?? opts.heading, fontSize: 36, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 650, width: 800, fontFamily: opts.heading, fontSize: 66, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 740 }),
    { id: "photo", type: "image" as const, field: "coverImage", x: 200, y: 800, width: 680, height: 260, rx: 12 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1120, width: 760, fontFamily: opts.body, fontSize: 22, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.6, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 1165, width: 760, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1230, width: 760, fontFamily: opts.heading, fontSize: 28, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1275, width: 760, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1335, width: 100, height: 100 },
  ];
}

/** Generous whitespace around a large hero photo — cool/minimal editorial look. */
function photoSpacedElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "photo", type: "image" as const, field: "coverImage", x: 120, y: 100, width: 840, height: 560, rx: 4 },
    { id: "motif-mid", type: "motif" as const, motif: opts.motif, x: 540, y: 720, width: 120, height: 36, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 790, width: 720, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const, maxLines: 2, letterSpacing: 1.8, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 880, width: 800, fontFamily: opts.heading, fontSize: 56, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 960, width: 100, fontFamily: opts.accent ?? opts.heading, fontSize: 28, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 1030, width: 800, fontFamily: opts.heading, fontSize: 56, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    parentsElement({ body: opts.body, y: 1100 }),
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1170, width: 720, fontFamily: opts.body, fontSize: 20, fill: "ink", textAnchor: "middle" as const, letterSpacing: 2, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 1210, width: 720, fontFamily: opts.body, fontSize: 17, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1270, width: 720, fontFamily: opts.heading, fontSize: 24, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1315, width: 720, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "middle" as const, maxLines: 1 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 500, y: 1360, width: 80, height: 80 },
  ];
}

/** Two stacked photos with breathing room — duo collage. */
function collageDuoElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "photo-a", type: "image" as const, field: "coverImage", x: 100, y: 80, width: 880, height: 380, rx: 6 },
    { id: "photo-b", type: "image" as const, field: "photo2", x: 180, y: 500, width: 720, height: 300, rx: 6 },
    { id: "motif-mid", type: "motif" as const, motif: opts.motif, x: 540, y: 860, width: 100, height: 30, fill: "accent" },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 920, width: 700, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "middle" as const, maxLines: 2, letterSpacing: 1.5, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 990, width: 780, fontFamily: opts.heading, fontSize: 48, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 1055, width: 80, fontFamily: opts.accent ?? opts.heading, fontSize: 26, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 1115, width: 780, fontFamily: opts.heading, fontSize: 48, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1200, width: 700, fontFamily: opts.body, fontSize: 18, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.6, textTransform: "uppercase" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1260, width: 700, fontFamily: opts.heading, fontSize: 22, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1305, width: 700, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, maxLines: 1 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 500, y: 1355, width: 80, height: 80 },
  ];
}

/** Three photos: hero + two side-by-side — trio collage. */
function collageTrioElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "photo-a", type: "image" as const, field: "coverImage", x: 100, y: 72, width: 880, height: 360, rx: 4 },
    { id: "photo-b", type: "image" as const, field: "photo2", x: 100, y: 460, width: 420, height: 320, rx: 4 },
    { id: "photo-c", type: "image" as const, field: "photo3", x: 560, y: 460, width: 420, height: 320, rx: 4 },
    { id: "kicker", type: "text" as const, field: "invitationMessage", x: 540, y: 860, width: 720, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "middle" as const, maxLines: 2, letterSpacing: 1.6, textTransform: "uppercase" as const },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 940, width: 800, fontFamily: opts.heading, fontSize: 50, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 1010, width: 80, fontFamily: opts.accent ?? opts.heading, fontSize: 26, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 1075, width: 800, fontFamily: opts.heading, fontSize: 50, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1165, width: 720, fontFamily: opts.body, fontSize: 18, fill: "ink", textAnchor: "middle" as const, letterSpacing: 1.8, textTransform: "uppercase" as const },
    { id: "time", type: "text" as const, field: "formattedTime", x: 540, y: 1205, width: 720, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1265, width: 720, fontFamily: opts.heading, fontSize: 22, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1310, width: 720, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, maxLines: 1 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 500, y: 1360, width: 80, height: 80 },
  ];
}

/** 2×2 photo grid with minimal type below — magazine collage. */
function collageGridElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "photo-a", type: "image" as const, field: "coverImage", x: 80, y: 72, width: 440, height: 360, rx: 3 },
    { id: "photo-b", type: "image" as const, field: "photo2", x: 560, y: 72, width: 440, height: 360, rx: 3 },
    { id: "photo-c", type: "image" as const, field: "photo3", x: 80, y: 468, width: 440, height: 360, rx: 3 },
    { id: "photo-d", type: "image" as const, field: "photo4", x: 560, y: 468, width: 440, height: 360, rx: 3 },
    { id: "line", type: "line" as const, x: 360, y: 900, width: 360, stroke: "line", strokeWidth: 1 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 970, width: 820, fontFamily: opts.heading, fontSize: 46, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 1035, width: 80, fontFamily: opts.accent ?? opts.heading, fontSize: 24, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 1095, width: 820, fontFamily: opts.heading, fontSize: 46, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1185, width: 720, fontFamily: opts.body, fontSize: 17, fill: "ink", textAnchor: "middle" as const, letterSpacing: 2, textTransform: "uppercase" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1245, width: 720, fontFamily: opts.heading, fontSize: 22, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1290, width: 720, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, maxLines: 1 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 500, y: 1345, width: 80, height: 80 },
  ];
}

/**
 * 2×2 polaroid mats: white frames with inset photo windows so cover-crop
 * clips inside the mat (thicker bottom border, classic polaroid look).
 */
function collagePolaroidElements(opts: { heading: string; body: string; accent?: string; motif: MotifKind }): ElementSpec[] {
  const mats: { id: string; field: string; mx: number; my: number }[] = [
    { id: "a", field: "coverImage", mx: 72, my: 56 },
    { id: "b", field: "photo2", mx: 556, my: 56 },
    { id: "c", field: "photo3", mx: 72, my: 460 },
    { id: "d", field: "photo4", mx: 556, my: 460 },
  ];
  const matW = 452;
  const matH = 380;
  const insetX = 18;
  const insetY = 18;
  const insetBottom = 52;
  const photoW = matW - insetX * 2;
  const photoH = matH - insetY - insetBottom;

  const polaroids = mats.flatMap(({ id, field, mx, my }) => [
    { id: `mat-${id}`, type: "rect" as const, x: mx, y: my, width: matW, height: matH, fill: "#ffffff", rx: 4 },
    {
      id: `photo-${id}`,
      type: "image" as const,
      field,
      x: mx + insetX,
      y: my + insetY,
      width: photoW,
      height: photoH,
      rx: 2,
    },
  ]);

  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    ...polaroids,
    { id: "line", type: "line" as const, x: 360, y: 900, width: 360, stroke: "line", strokeWidth: 1 },
    { id: "name-one", type: "text" as const, field: "primaryName", x: 540, y: 970, width: 820, fontFamily: opts.heading, fontSize: 46, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "amp", type: "text" as const, field: "ampersand", x: 540, y: 1035, width: 80, fontFamily: opts.accent ?? opts.heading, fontSize: 24, fill: "accent", textAnchor: "middle" as const },
    { id: "name-two", type: "text" as const, field: "secondaryName", x: 540, y: 1095, width: 820, fontFamily: opts.heading, fontSize: 46, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "date", type: "text" as const, field: "formattedDate", x: 540, y: 1185, width: 720, fontFamily: opts.body, fontSize: 17, fill: "ink", textAnchor: "middle" as const, letterSpacing: 2, textTransform: "uppercase" as const },
    { id: "venue", type: "text" as const, field: "venueName", x: 540, y: 1245, width: 720, fontFamily: opts.heading, fontSize: 22, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "city", type: "text" as const, field: "cityLine", x: 540, y: 1290, width: 720, fontFamily: opts.body, fontSize: 14, fill: "muted", textAnchor: "middle" as const, maxLines: 1 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 500, y: 1345, width: 80, height: 80 },
  ];
}

function elementsForLayout(
  layout: InviteLayout,
  opts: { heading: string; body: string; accent?: string; motif: MotifKind },
): ElementSpec[] {
  switch (layout) {
    case "photo":
      return classicElements({ ...opts, hasPhoto: true });
    case "dark":
      return darkElements(opts);
    case "split":
      return splitElements(opts);
    case "centered":
      return centeredElements(opts);
    case "festive":
      return festiveElements(opts);
    case "traditional":
      return traditionalElements(opts);
    case "banner":
      return bannerElements(opts);
    case "royal":
      return royalElements(opts);
    case "cultural":
      return culturalElements(opts);
    case "floral-edge":
      return floralEdgeElements(opts);
    case "lace":
      return laceElements(opts);
    case "arch":
      return archElements(opts);
    case "vine":
      return vineElements(opts);
    case "mehendi":
      return mehendiElements(opts);
    case "garland":
      return garlandElements(opts);
    case "photo-spaced":
      return photoSpacedElements(opts);
    case "collage-duo":
      return collageDuoElements(opts);
    case "collage-trio":
      return collageTrioElements(opts);
    case "collage-grid":
      return collageGridElements(opts);
    case "collage-polaroid":
      return collagePolaroidElements(opts);
    default:
      return classicElements({ ...opts, hasPhoto: false });
  }
}

export function classicInvitation(opts: {
  id: string;
  name: string;
  category: string;
  tags: string[];
  eventTypes: EventTypeId[];
  palette: Palette;
  heading: string;
  body: string;
  accent?: string;
  motif: MotifKind;
  layout?: InviteLayout;
}): TemplateDefinition {
  const primaryType = opts.eventTypes[0];
  const colors = { ...opts.palette };
  const layout = opts.layout ?? "classic";

  return {
    id: opts.id,
    name: opts.name,
    kind: "invitation",
    eventTypes: opts.eventTypes,
    category: opts.category,
    tags: opts.tags,
    orientation: "portrait",
    dimensions: PORTRAIT,
    background: { type: "solid", colors: [colors.paper] },
    fonts: { heading: opts.heading, body: opts.body, accent: opts.accent },
    colors,
    fields: invitationFields(primaryType),
    previewHint: opts.name,
    license: LICENSE,
    elements: elementsForLayout(layout, {
      heading: opts.heading,
      body: opts.body,
      accent: opts.accent,
      motif: opts.motif,
    }),
  };
}

function portraitCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "frame", type: "frame" as const, x: 48, y: 48, width: 984, height: 1416, stroke: "line", strokeWidth: 1.2 },
    { id: "photo", type: "image" as const, field: "photo", x: 180, y: 110, width: 720, height: 520, rx: 8 },
    { id: "name", type: "text" as const, field: "fullName", x: 540, y: 720, width: 860, fontFamily: opts.heading, fontSize: 56, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "role", type: "text" as const, field: "roleLine", x: 540, y: 790, width: 820, fontFamily: opts.body, fontSize: 22, fill: "accent", textAnchor: "middle" as const, maxLines: 2 },
    { id: "line", type: "line" as const, x: 390, y: 830, width: 300, stroke: "line", strokeWidth: 1 },
    { id: "facts", type: "text" as const, field: "factLine", x: 540, y: 900, width: 820, fontFamily: opts.body, fontSize: 20, fill: "ink", textAnchor: "middle" as const, maxLines: 4, lineHeight: 1.5 },
    { id: "about", type: "text" as const, field: "about", x: 540, y: 1080, width: 780, fontFamily: opts.body, fontSize: 20, fill: "muted", textAnchor: "middle" as const, maxLines: 5 },
    { id: "card-extras", type: "text" as const, field: "cardExtras", x: 540, y: 1220, width: 780, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "contact", type: "text" as const, field: "contactLine", x: 540, y: 1280, width: 780, fontFamily: opts.body, fontSize: 18, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1336, width: 100, height: 100 },
  ];
}

function splitCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "photo", type: "image" as const, field: "photo", x: 0, y: 0, width: 1080, height: 620, rx: 0 },
    { id: "accent", type: "rect" as const, x: 0, y: 620, width: 1080, height: 10, fill: "accent" },
    { id: "name", type: "text" as const, field: "fullName", x: 540, y: 760, width: 900, fontFamily: opts.heading, fontSize: 58, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "role", type: "text" as const, field: "roleLine", x: 540, y: 840, width: 860, fontFamily: opts.body, fontSize: 22, fill: "accent", textAnchor: "middle" as const, maxLines: 2 },
    { id: "facts", type: "text" as const, field: "factLine", x: 540, y: 960, width: 860, fontFamily: opts.body, fontSize: 20, fill: "ink", textAnchor: "middle" as const, maxLines: 4, lineHeight: 1.45 },
    { id: "about", type: "text" as const, field: "about", x: 540, y: 1140, width: 820, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 4 },
    { id: "card-extras", type: "text" as const, field: "cardExtras", x: 540, y: 1260, width: 800, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "contact", type: "text" as const, field: "contactLine", x: 540, y: 1320, width: 800, fontFamily: opts.body, fontSize: 17, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1370, width: 90, height: 90 },
  ];
}

function folioCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "side", type: "rect" as const, x: 0, y: 0, width: 28, height: 1512, fill: "accent" },
    { id: "photo", type: "image" as const, field: "photo", x: 120, y: 100, width: 400, height: 480, rx: 4 },
    { id: "name", type: "text" as const, field: "fullName", x: 580, y: 180, width: 420, fontFamily: opts.heading, fontSize: 44, fill: "ink", textAnchor: "start" as const, maxLines: 3 },
    { id: "role", type: "text" as const, field: "roleLine", x: 580, y: 340, width: 420, fontFamily: opts.body, fontSize: 20, fill: "accent", textAnchor: "start" as const, maxLines: 3 },
    { id: "line", type: "line" as const, x: 120, y: 640, width: 840, stroke: "line", strokeWidth: 1 },
    { id: "facts", type: "text" as const, field: "factLine", x: 120, y: 720, width: 840, fontFamily: opts.body, fontSize: 20, fill: "ink", textAnchor: "start" as const, maxLines: 5, lineHeight: 1.5 },
    { id: "about", type: "text" as const, field: "about", x: 120, y: 960, width: 840, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "start" as const, maxLines: 6 },
    { id: "card-extras", type: "text" as const, field: "cardExtras", x: 120, y: 1200, width: 840, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "start" as const, maxLines: 2 },
    { id: "contact", type: "text" as const, field: "contactLine", x: 120, y: 1280, width: 700, fontFamily: opts.body, fontSize: 17, fill: "ink", textAnchor: "start" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 900, y: 1320, width: 100, height: 100 },
  ];
}

function circleCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "frame", type: "frame" as const, x: 56, y: 56, width: 968, height: 1400, stroke: "line", strokeWidth: 1 },
    { id: "photo", type: "image" as const, field: "photo", x: 290, y: 120, width: 500, height: 500, rx: 250 },
    { id: "name", type: "text" as const, field: "fullName", x: 540, y: 720, width: 860, fontFamily: opts.heading, fontSize: 52, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "role", type: "text" as const, field: "roleLine", x: 540, y: 800, width: 820, fontFamily: opts.body, fontSize: 20, fill: "accent", textAnchor: "middle" as const, maxLines: 2 },
    { id: "facts", type: "text" as const, field: "factLine", x: 540, y: 920, width: 820, fontFamily: opts.body, fontSize: 18, fill: "ink", textAnchor: "middle" as const, maxLines: 4, lineHeight: 1.5 },
    { id: "about", type: "text" as const, field: "about", x: 540, y: 1100, width: 780, fontFamily: opts.body, fontSize: 18, fill: "muted", textAnchor: "middle" as const, maxLines: 4 },
    { id: "contact", type: "text" as const, field: "contactLine", x: 540, y: 1280, width: 780, fontFamily: opts.body, fontSize: 17, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 490, y: 1340, width: 90, height: 90 },
  ];
}

/** Classic marriage biodata sheet — clean white page, thin border, 3 sections. */
function biodataClassicCardElements(opts: {
  heading: string;
  body: string;
  blessing?: MotifKind;
  withPhoto?: boolean;
}): ElementSpec[] {
  const brown = "accent";
  const ink = "ink";
  const muted = "muted";
  const withPhoto = opts.withPhoto !== false;
  const topY = opts.blessing ? 150 : 110;
  const photoY = opts.blessing ? 208 : 168;
  const rowsY = opts.blessing ? 225 : 185;
  const personalW = withPhoto ? 650 : 880;
  const ruleW = withPhoto ? 640 : 880;
  const elements: ElementSpec[] = [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "border", type: "frame" as const, x: 48, y: 48, width: 984, height: 1416, stroke: brown, strokeWidth: 1.25 },
  ];

  if (opts.blessing) {
    elements.push({
      id: "blessing",
      type: "motif" as const,
      motif: opts.blessing,
      x: 540,
      y: 88,
      width: 72,
      height: 72,
      fill: brown,
    });
  }

  elements.push(
    {
      id: "personal-h",
      type: "text" as const,
      staticText: "PERSONAL DETAILS",
      x: 100,
      y: topY,
      width: withPhoto ? 700 : 880,
      fontFamily: opts.body,
      fontSize: 20,
      fontWeight: 700,
      fill: brown,
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "personal-rule", type: "line" as const, x: 100, y: topY + 18, width: ruleW, stroke: "line", strokeWidth: 1 },
  );

  if (withPhoto) {
    elements.push(
      { id: "photo", type: "image" as const, field: "photo", x: 780, y: photoY, width: 200, height: 260, rx: 2 },
      { id: "photo-frame", type: "frame" as const, x: 780, y: photoY, width: 200, height: 260, stroke: brown, strokeWidth: 1 },
    );
  }

  elements.push(
    {
      id: "personal-rows",
      type: "text" as const,
      field: "biodataPersonalRows",
      x: 100,
      y: rowsY,
      width: personalW,
      fontFamily: opts.body,
      fontSize: 16,
      fill: ink,
      textAnchor: "start" as const,
      maxLines: 12,
      lineHeight: 1.55,
    },
    {
      id: "family-h",
      type: "text" as const,
      staticText: "FAMILY DETAILS",
      x: 100,
      y: 560,
      width: 880,
      fontFamily: opts.body,
      fontSize: 20,
      fontWeight: 700,
      fill: brown,
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "family-rule", type: "line" as const, x: 100, y: 578, width: 880, stroke: "line", strokeWidth: 1 },
    {
      id: "family-rows",
      type: "text" as const,
      field: "biodataFamilyRows",
      x: 100,
      y: 610,
      width: 880,
      fontFamily: opts.body,
      fontSize: 16,
      fill: ink,
      textAnchor: "start" as const,
      maxLines: 6,
      lineHeight: 1.55,
    },
    {
      id: "contact-h",
      type: "text" as const,
      staticText: "CONTACT DETAILS",
      x: 100,
      y: 860,
      width: 880,
      fontFamily: opts.body,
      fontSize: 20,
      fontWeight: 700,
      fill: brown,
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "contact-rule", type: "line" as const, x: 100, y: 878, width: 880, stroke: "line", strokeWidth: 1 },
    {
      id: "contact-rows",
      type: "text" as const,
      field: "biodataContactRows",
      x: 100,
      y: 910,
      width: 880,
      fontFamily: opts.body,
      fontSize: 16,
      fill: ink,
      textAnchor: "start" as const,
      maxLines: 6,
      lineHeight: 1.55,
    },
    {
      id: "notes-rows",
      type: "text" as const,
      field: "biodataNotesRows",
      x: 100,
      y: 1180,
      width: 880,
      fontFamily: opts.body,
      fontSize: 14,
      fill: muted,
      textAnchor: "start" as const,
      maxLines: 4,
      lineHeight: 1.45,
    },
  );

  return elements;
}

/** Photo sidebar — portrait panel left, biodata sections right. */
function biodataSidebarCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "panel", type: "rect" as const, x: 0, y: 0, width: 400, height: 1512, fill: "accent" },
    { id: "photo", type: "image" as const, field: "photo", x: 48, y: 120, width: 304, height: 400, rx: 8 },
    { id: "photo-frame", type: "frame" as const, x: 48, y: 120, width: 304, height: 400, stroke: "paper", strokeWidth: 2 },
    {
      id: "side-name",
      type: "text" as const,
      field: "fullName",
      x: 200,
      y: 560,
      width: 320,
      fontFamily: opts.heading,
      fontSize: 28,
      fill: "paper",
      textAnchor: "middle" as const,
      maxLines: 3,
    },
    {
      id: "side-role",
      type: "text" as const,
      field: "roleLine",
      x: 200,
      y: 660,
      width: 300,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "paper",
      textAnchor: "middle" as const,
      maxLines: 3,
    },
    {
      id: "personal-h",
      type: "text" as const,
      staticText: "PERSONAL DETAILS",
      x: 460,
      y: 100,
      width: 540,
      fontFamily: opts.body,
      fontSize: 16,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
    },
    { id: "personal-rule", type: "line" as const, x: 460, y: 120, width: 520, stroke: "line", strokeWidth: 1 },
    {
      id: "personal-rows",
      type: "text" as const,
      field: "biodataPersonalRows",
      x: 460,
      y: 150,
      width: 540,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 11,
      lineHeight: 1.5,
    },
    {
      id: "family-h",
      type: "text" as const,
      staticText: "FAMILY DETAILS",
      x: 460,
      y: 720,
      width: 540,
      fontFamily: opts.body,
      fontSize: 16,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
    },
    { id: "family-rule", type: "line" as const, x: 460, y: 740, width: 520, stroke: "line", strokeWidth: 1 },
    {
      id: "family-rows",
      type: "text" as const,
      field: "biodataFamilyRows",
      x: 460,
      y: 770,
      width: 540,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 6,
      lineHeight: 1.5,
    },
    {
      id: "contact-h",
      type: "text" as const,
      staticText: "CONTACT DETAILS",
      x: 460,
      y: 1040,
      width: 540,
      fontFamily: opts.body,
      fontSize: 16,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
    },
    { id: "contact-rule", type: "line" as const, x: 460, y: 1060, width: 520, stroke: "line", strokeWidth: 1 },
    {
      id: "contact-rows",
      type: "text" as const,
      field: "biodataContactRows",
      x: 460,
      y: 1090,
      width: 540,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 5,
      lineHeight: 1.5,
    },
    {
      id: "notes-rows",
      type: "text" as const,
      field: "biodataNotesRows",
      x: 460,
      y: 1320,
      width: 540,
      fontFamily: opts.body,
      fontSize: 13,
      fill: "muted",
      textAnchor: "start" as const,
      maxLines: 3,
      lineHeight: 1.4,
    },
  ];
}

/** Split columns — personal band on top; family & contact side by side. */
function biodataColumnsCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "top-band", type: "rect" as const, x: 48, y: 48, width: 984, height: 520, fill: "line", opacity: 0.35 },
    { id: "photo", type: "image" as const, field: "photo", x: 780, y: 88, width: 200, height: 260, rx: 4 },
    { id: "photo-frame", type: "frame" as const, x: 780, y: 88, width: 200, height: 260, stroke: "accent", strokeWidth: 1.5 },
    {
      id: "personal-h",
      type: "text" as const,
      staticText: "PERSONAL DETAILS",
      x: 88,
      y: 100,
      width: 640,
      fontFamily: opts.body,
      fontSize: 18,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "personal-rule", type: "decor" as const, decor: "section-ornament", x: 88, y: 118, width: 560, height: 32, fill: "accent" },
    {
      id: "personal-rows",
      type: "text" as const,
      field: "biodataPersonalRows",
      x: 88,
      y: 170,
      width: 660,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 11,
      lineHeight: 1.5,
    },
    { id: "col-divider", type: "rect" as const, x: 539, y: 620, width: 2, height: 720, fill: "line" },
    {
      id: "family-h",
      type: "text" as const,
      staticText: "FAMILY DETAILS",
      x: 88,
      y: 620,
      width: 400,
      fontFamily: opts.body,
      fontSize: 16,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
    },
    {
      id: "family-rows",
      type: "text" as const,
      field: "biodataFamilyRows",
      x: 88,
      y: 670,
      width: 400,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 8,
      lineHeight: 1.55,
    },
    {
      id: "contact-h",
      type: "text" as const,
      staticText: "CONTACT DETAILS",
      x: 600,
      y: 620,
      width: 400,
      fontFamily: opts.body,
      fontSize: 16,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
    },
    {
      id: "contact-rows",
      type: "text" as const,
      field: "biodataContactRows",
      x: 600,
      y: 670,
      width: 400,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 8,
      lineHeight: 1.55,
    },
    {
      id: "notes-rows",
      type: "text" as const,
      field: "biodataNotesRows",
      x: 88,
      y: 1280,
      width: 900,
      fontFamily: opts.body,
      fontSize: 14,
      fill: "muted",
      textAnchor: "start" as const,
      maxLines: 4,
      lineHeight: 1.4,
    },
  ];
}

/** Clean modern biodata — accent bar, rounded photo, no florals. */
function biodataModernCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "bar", type: "rect" as const, x: 0, y: 0, width: 1080, height: 16, fill: "accent" },
    {
      id: "title",
      type: "text" as const,
      staticText: "BIO DATA",
      x: 80,
      y: 70,
      width: 400,
      fontFamily: opts.body,
      fontSize: 13,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 3,
      textTransform: "uppercase" as const,
    },
    {
      id: "name",
      type: "text" as const,
      field: "fullName",
      x: 80,
      y: 120,
      width: 640,
      fontFamily: opts.heading,
      fontSize: 48,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 2,
    },
    {
      id: "role",
      type: "text" as const,
      field: "roleLine",
      x: 80,
      y: 220,
      width: 640,
      fontFamily: opts.body,
      fontSize: 18,
      fill: "muted",
      textAnchor: "start" as const,
      maxLines: 2,
    },
    { id: "photo", type: "image" as const, field: "photo", x: 780, y: 70, width: 220, height: 280, rx: 16 },
    {
      id: "personal-h",
      type: "text" as const,
      staticText: "Personal",
      x: 80,
      y: 400,
      width: 400,
      fontFamily: opts.body,
      fontSize: 14,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.6,
      textTransform: "uppercase" as const,
    },
    { id: "personal-rule", type: "line" as const, x: 80, y: 420, width: 920, stroke: "line", strokeWidth: 1 },
    {
      id: "personal-rows",
      type: "text" as const,
      field: "biodataPersonalRows",
      x: 80,
      y: 450,
      width: 920,
      fontFamily: opts.body,
      fontSize: 16,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 10,
      lineHeight: 1.5,
    },
    {
      id: "family-h",
      type: "text" as const,
      staticText: "Family",
      x: 80,
      y: 900,
      width: 400,
      fontFamily: opts.body,
      fontSize: 14,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.6,
      textTransform: "uppercase" as const,
    },
    { id: "family-rule", type: "line" as const, x: 80, y: 920, width: 920, stroke: "line", strokeWidth: 1 },
    {
      id: "family-rows",
      type: "text" as const,
      field: "biodataFamilyRows",
      x: 80,
      y: 950,
      width: 920,
      fontFamily: opts.body,
      fontSize: 16,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 5,
      lineHeight: 1.5,
    },
    {
      id: "contact-h",
      type: "text" as const,
      staticText: "Contact",
      x: 80,
      y: 1160,
      width: 400,
      fontFamily: opts.body,
      fontSize: 14,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.6,
      textTransform: "uppercase" as const,
    },
    { id: "contact-rule", type: "line" as const, x: 80, y: 1180, width: 920, stroke: "line", strokeWidth: 1 },
    {
      id: "contact-rows",
      type: "text" as const,
      field: "biodataContactRows",
      x: 80,
      y: 1210,
      width: 920,
      fontFamily: opts.body,
      fontSize: 16,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 4,
      lineHeight: 1.5,
    },
  ];
}

/** Arch-top biodata — formal arch header, clean filled sections. */
function biodataArchCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "arch", type: "decor" as const, decor: "arch-top", x: 120, y: 48, width: 840, height: 280, fill: "accent" },
    { id: "photo", type: "image" as const, field: "photo", x: 415, y: 100, width: 250, height: 300, rx: 4 },
    { id: "photo-frame", type: "frame" as const, x: 415, y: 100, width: 250, height: 300, stroke: "accent", strokeWidth: 1.5 },
    {
      id: "name",
      type: "text" as const,
      field: "fullName",
      x: 540,
      y: 440,
      width: 900,
      fontFamily: opts.heading,
      fontSize: 36,
      fill: "ink",
      textAnchor: "middle" as const,
      maxLines: 2,
    },
    {
      id: "role",
      type: "text" as const,
      field: "roleLine",
      x: 540,
      y: 500,
      width: 820,
      fontFamily: opts.body,
      fontSize: 16,
      fill: "accent",
      textAnchor: "middle" as const,
      maxLines: 1,
    },
    {
      id: "personal-h",
      type: "text" as const,
      staticText: "PERSONAL DETAILS",
      x: 100,
      y: 560,
      width: 880,
      fontFamily: opts.body,
      fontSize: 16,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "personal-rule", type: "line" as const, x: 100, y: 580, width: 880, stroke: "line", strokeWidth: 1 },
    {
      id: "personal-rows",
      type: "text" as const,
      field: "biodataPersonalRows",
      x: 100,
      y: 610,
      width: 880,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 8,
      lineHeight: 1.5,
    },
    {
      id: "family-h",
      type: "text" as const,
      staticText: "FAMILY DETAILS",
      x: 100,
      y: 980,
      width: 880,
      fontFamily: opts.body,
      fontSize: 16,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "family-rule", type: "line" as const, x: 100, y: 1000, width: 880, stroke: "line", strokeWidth: 1 },
    {
      id: "family-rows",
      type: "text" as const,
      field: "biodataFamilyRows",
      x: 100,
      y: 1030,
      width: 880,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 5,
      lineHeight: 1.5,
    },
    {
      id: "contact-h",
      type: "text" as const,
      staticText: "CONTACT DETAILS",
      x: 100,
      y: 1220,
      width: 880,
      fontFamily: opts.body,
      fontSize: 16,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "contact-rule", type: "line" as const, x: 100, y: 1240, width: 880, stroke: "line", strokeWidth: 1 },
    {
      id: "contact-rows",
      type: "text" as const,
      field: "biodataContactRows",
      x: 100,
      y: 1270,
      width: 880,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 4,
      lineHeight: 1.5,
    },
  ];
}

/** Garland biodata — floral garland header, filled Label : value body. */
function biodataGarlandCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "garland", type: "decor" as const, decor: "garland-top", x: 100, y: 36, width: 880, height: 120, fill: "accent" },
    { id: "border", type: "frame" as const, x: 56, y: 56, width: 968, height: 1400, stroke: "accent", strokeWidth: 1.25 },
    {
      id: "title",
      type: "text" as const,
      staticText: "BIO DATA",
      x: 540,
      y: 150,
      width: 400,
      fontFamily: opts.body,
      fontSize: 14,
      fill: "accent",
      textAnchor: "middle" as const,
      letterSpacing: 3,
      textTransform: "uppercase" as const,
    },
    { id: "photo", type: "image" as const, field: "photo", x: 790, y: 190, width: 180, height: 230, rx: 2 },
    { id: "photo-frame", type: "frame" as const, x: 790, y: 190, width: 180, height: 230, stroke: "accent", strokeWidth: 1 },
    {
      id: "personal-h",
      type: "text" as const,
      staticText: "PERSONAL DETAILS",
      x: 100,
      y: 190,
      width: 640,
      fontFamily: opts.body,
      fontSize: 18,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.3,
      textTransform: "uppercase" as const,
    },
    {
      id: "personal-rows",
      type: "text" as const,
      field: "biodataPersonalRows",
      x: 100,
      y: 240,
      width: 640,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 11,
      lineHeight: 1.5,
    },
    {
      id: "family-h",
      type: "text" as const,
      staticText: "FAMILY DETAILS",
      x: 100,
      y: 720,
      width: 880,
      fontFamily: opts.body,
      fontSize: 18,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.3,
      textTransform: "uppercase" as const,
    },
    {
      id: "family-rows",
      type: "text" as const,
      field: "biodataFamilyRows",
      x: 100,
      y: 770,
      width: 880,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 6,
      lineHeight: 1.5,
    },
    {
      id: "contact-h",
      type: "text" as const,
      staticText: "CONTACT DETAILS",
      x: 100,
      y: 1040,
      width: 880,
      fontFamily: opts.body,
      fontSize: 18,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.3,
      textTransform: "uppercase" as const,
    },
    {
      id: "contact-rows",
      type: "text" as const,
      field: "biodataContactRows",
      x: 100,
      y: 1090,
      width: 880,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 5,
      lineHeight: 1.5,
    },
    {
      id: "notes-rows",
      type: "text" as const,
      field: "biodataNotesRows",
      x: 100,
      y: 1300,
      width: 880,
      fontFamily: opts.body,
      fontSize: 14,
      fill: "muted",
      textAnchor: "start" as const,
      maxLines: 3,
      lineHeight: 1.4,
    },
  ];
}

/** Double gold frame biodata — premium formal sheet. */
function biodataGoldCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "outer", type: "frame" as const, x: 40, y: 40, width: 1000, height: 1432, stroke: "accent", strokeWidth: 2.5 },
    { id: "inner", type: "frame" as const, x: 56, y: 56, width: 968, height: 1400, stroke: "accent", strokeWidth: 1 },
    { id: "corners", type: "decor" as const, decor: "ornate-corners", x: 56, y: 56, width: 968, height: 1400, fill: "accent" },
    {
      id: "title",
      type: "text" as const,
      staticText: "BIO DATA",
      x: 540,
      y: 100,
      width: 400,
      fontFamily: opts.body,
      fontSize: 14,
      fill: "accent",
      textAnchor: "middle" as const,
      letterSpacing: 4,
      textTransform: "uppercase" as const,
    },
    { id: "photo", type: "image" as const, field: "photo", x: 780, y: 140, width: 200, height: 260, rx: 2 },
    { id: "photo-frame", type: "frame" as const, x: 780, y: 140, width: 200, height: 260, stroke: "accent", strokeWidth: 1.5 },
    {
      id: "personal-h",
      type: "text" as const,
      staticText: "PERSONAL DETAILS",
      x: 100,
      y: 140,
      width: 640,
      fontFamily: opts.body,
      fontSize: 18,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "personal-rule", type: "decor" as const, decor: "section-ornament", x: 100, y: 158, width: 560, height: 32, fill: "accent" },
    {
      id: "personal-rows",
      type: "text" as const,
      field: "biodataPersonalRows",
      x: 100,
      y: 210,
      width: 640,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 11,
      lineHeight: 1.5,
    },
    {
      id: "family-h",
      type: "text" as const,
      staticText: "FAMILY DETAILS",
      x: 100,
      y: 680,
      width: 880,
      fontFamily: opts.body,
      fontSize: 18,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "family-rule", type: "decor" as const, decor: "section-ornament", x: 100, y: 698, width: 880, height: 32, fill: "accent" },
    {
      id: "family-rows",
      type: "text" as const,
      field: "biodataFamilyRows",
      x: 100,
      y: 750,
      width: 880,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 6,
      lineHeight: 1.5,
    },
    {
      id: "contact-h",
      type: "text" as const,
      staticText: "CONTACT DETAILS",
      x: 100,
      y: 1000,
      width: 880,
      fontFamily: opts.body,
      fontSize: 18,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
    { id: "contact-rule", type: "decor" as const, decor: "section-ornament", x: 100, y: 1018, width: 880, height: 32, fill: "accent" },
    {
      id: "contact-rows",
      type: "text" as const,
      field: "biodataContactRows",
      x: 100,
      y: 1070,
      width: 880,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 5,
      lineHeight: 1.5,
    },
  ];
}

/** Compact filled biodata — denser rows, tight margins, no ornament clutter. */
function biodataCompactCardElements(opts: {
  heading: string;
  body: string;
  blessing?: MotifKind;
  withPhoto?: boolean;
}): ElementSpec[] {
  const withPhoto = opts.withPhoto !== false;
  const topY = opts.blessing ? 120 : 80;
  const rowsY = opts.blessing ? 160 : 120;
  const personalW = withPhoto ? 680 : 940;
  const elements: ElementSpec[] = [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "border", type: "frame" as const, x: 40, y: 40, width: 1000, height: 1432, stroke: "accent", strokeWidth: 1.5 },
  ];
  if (opts.blessing) {
    elements.push({
      id: "blessing",
      type: "motif" as const,
      motif: opts.blessing,
      x: 540,
      y: 78,
      width: 64,
      height: 64,
      fill: "accent",
    });
  }
  if (withPhoto) {
    elements.push(
      { id: "photo", type: "image" as const, field: "photo", x: 800, y: opts.blessing ? 112 : 72, width: 200, height: 250, rx: 0 },
      {
        id: "photo-frame",
        type: "frame" as const,
        x: 800,
        y: opts.blessing ? 112 : 72,
        width: 200,
        height: 250,
        stroke: "accent",
        strokeWidth: 1,
      },
    );
  }
  elements.push(
    {
      id: "personal-h",
      type: "text" as const,
      staticText: "PERSONAL DETAILS",
      x: 72,
      y: topY,
      width: personalW,
      fontFamily: opts.body,
      fontSize: 17,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
    },
    {
      id: "personal-rows",
      type: "text" as const,
      field: "biodataPersonalRows",
      x: 72,
      y: rowsY,
      width: personalW,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 12,
      lineHeight: 1.42,
    },
    {
      id: "family-h",
      type: "text" as const,
      staticText: "FAMILY DETAILS",
      x: 72,
      y: 560,
      width: 940,
      fontFamily: opts.body,
      fontSize: 17,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
    },
    {
      id: "family-rows",
      type: "text" as const,
      field: "biodataFamilyRows",
      x: 72,
      y: 600,
      width: 940,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 7,
      lineHeight: 1.42,
    },
    {
      id: "contact-h",
      type: "text" as const,
      staticText: "CONTACT DETAILS",
      x: 72,
      y: 880,
      width: 940,
      fontFamily: opts.body,
      fontSize: 17,
      fontWeight: 700,
      fill: "accent",
      textAnchor: "start" as const,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
    },
    {
      id: "contact-rows",
      type: "text" as const,
      field: "biodataContactRows",
      x: 72,
      y: 920,
      width: 940,
      fontFamily: opts.body,
      fontSize: 15,
      fill: "ink",
      textAnchor: "start" as const,
      maxLines: 6,
      lineHeight: 1.42,
    },
    {
      id: "notes-rows",
      type: "text" as const,
      field: "biodataNotesRows",
      x: 72,
      y: 1180,
      width: 940,
      fontFamily: opts.body,
      fontSize: 14,
      fill: "muted",
      textAnchor: "start" as const,
      maxLines: 5,
      lineHeight: 1.4,
    },
  );
  return elements;
}

/** Cool light / spaced bio — photo, name, then labeled section blocks. */
function bioSpacedCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "photo", type: "image" as const, field: "photo", x: 120, y: 80, width: 840, height: 420, rx: 12 },
    { id: "name", type: "text" as const, field: "fullName", x: 120, y: 560, width: 840, fontFamily: opts.heading, fontSize: 52, fill: "ink", textAnchor: "start" as const, maxLines: 2 },
    { id: "role", type: "text" as const, field: "roleLine", x: 120, y: 640, width: 840, fontFamily: opts.body, fontSize: 20, fill: "accent", textAnchor: "start" as const, maxLines: 2 },
    { id: "personal", type: "text" as const, field: "bioPersonalBlock", x: 120, y: 720, width: 840, fontFamily: opts.body, fontSize: 17, fill: "ink", textAnchor: "start" as const, maxLines: 2, lineHeight: 1.45 },
    { id: "family", type: "text" as const, field: "bioFamilyBlock", x: 120, y: 800, width: 840, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "start" as const, maxLines: 2, lineHeight: 1.45 },
    { id: "education", type: "text" as const, field: "bioEducationBlock", x: 120, y: 880, width: 840, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "start" as const, maxLines: 2, lineHeight: 1.45 },
    { id: "work", type: "text" as const, field: "bioOccupationBlock", x: 120, y: 960, width: 840, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "start" as const, maxLines: 2, lineHeight: 1.45 },
    { id: "about-label", type: "text" as const, staticText: "About", x: 120, y: 1040, width: 200, fontFamily: opts.body, fontSize: 13, fill: "accent", textAnchor: "start" as const, letterSpacing: 1.6, textTransform: "uppercase" as const },
    { id: "about", type: "text" as const, field: "about", x: 120, y: 1075, width: 840, fontFamily: opts.body, fontSize: 18, fill: "ink", textAnchor: "start" as const, maxLines: 4, lineHeight: 1.4 },
    { id: "expectations", type: "text" as const, field: "bioExpectationsBlock", x: 120, y: 1220, width: 840, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "start" as const, maxLines: 2 },
    { id: "lifestyle", type: "text" as const, field: "bioLifestyleBlock", x: 120, y: 1280, width: 700, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "start" as const, maxLines: 2 },
    { id: "contact", type: "text" as const, field: "contactLine", x: 120, y: 1340, width: 700, fontFamily: opts.body, fontSize: 16, fill: "ink", textAnchor: "start" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 900, y: 1320, width: 90, height: 90 },
  ];
}

/** Editorial bio — left rail accent, stacked hierarchy with section headers. */
function bioEditorialCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "rail", type: "rect" as const, x: 0, y: 0, width: 18, height: 1512, fill: "accent" },
    { id: "photo", type: "image" as const, field: "photo", x: 80, y: 72, width: 360, height: 440, rx: 6 },
    { id: "name", type: "text" as const, field: "fullName", x: 480, y: 140, width: 520, fontFamily: opts.heading, fontSize: 44, fill: "ink", textAnchor: "start" as const, maxLines: 3 },
    { id: "role", type: "text" as const, field: "roleLine", x: 480, y: 300, width: 520, fontFamily: opts.body, fontSize: 18, fill: "accent", textAnchor: "start" as const, maxLines: 3 },
    { id: "personal", type: "text" as const, field: "personalLine", x: 480, y: 400, width: 520, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "start" as const, maxLines: 3, lineHeight: 1.45 },
    { id: "divider", type: "line" as const, x: 80, y: 560, width: 920, stroke: "line", strokeWidth: 1 },
    { id: "edu-label", type: "text" as const, staticText: "Education", x: 80, y: 620, width: 200, fontFamily: opts.body, fontSize: 12, fill: "accent", textAnchor: "start" as const, letterSpacing: 1.8, textTransform: "uppercase" as const },
    { id: "education", type: "text" as const, field: "educationLine", x: 80, y: 655, width: 920, fontFamily: opts.body, fontSize: 18, fill: "ink", textAnchor: "start" as const, maxLines: 2 },
    { id: "fam-label", type: "text" as const, staticText: "Family", x: 80, y: 740, width: 200, fontFamily: opts.body, fontSize: 12, fill: "accent", textAnchor: "start" as const, letterSpacing: 1.8, textTransform: "uppercase" as const },
    { id: "family", type: "text" as const, field: "familyLine", x: 80, y: 775, width: 920, fontFamily: opts.body, fontSize: 17, fill: "ink", textAnchor: "start" as const, maxLines: 2 },
    { id: "about-label", type: "text" as const, staticText: "About me", x: 80, y: 870, width: 200, fontFamily: opts.body, fontSize: 12, fill: "accent", textAnchor: "start" as const, letterSpacing: 1.8, textTransform: "uppercase" as const },
    { id: "about", type: "text" as const, field: "about", x: 80, y: 910, width: 920, fontFamily: opts.body, fontSize: 18, fill: "ink", textAnchor: "start" as const, maxLines: 5, lineHeight: 1.4 },
    { id: "expect", type: "text" as const, field: "bioExpectationsBlock", x: 80, y: 1100, width: 920, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "start" as const, maxLines: 2 },
    { id: "lifestyle", type: "text" as const, field: "bioLifestyleBlock", x: 80, y: 1170, width: 920, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "start" as const, maxLines: 2 },
    { id: "contact-label", type: "text" as const, staticText: "Contact", x: 80, y: 1260, width: 200, fontFamily: opts.body, fontSize: 12, fill: "accent", textAnchor: "start" as const, letterSpacing: 1.8, textTransform: "uppercase" as const },
    { id: "contact", type: "text" as const, field: "contactLine", x: 80, y: 1300, width: 780, fontFamily: opts.body, fontSize: 17, fill: "ink", textAnchor: "start" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 920, y: 1330, width: 80, height: 80 },
  ];
}

/** Split bio — full-bleed photo band, then two-column-ish stacked sections. */
function bioSplitCardElements(opts: { heading: string; body: string }): ElementSpec[] {
  return [
    { id: "bg", type: "rect" as const, x: 0, y: 0, width: 1080, height: 1512, fill: "paper" },
    { id: "photo", type: "image" as const, field: "photo", x: 0, y: 0, width: 1080, height: 520, rx: 0 },
    { id: "wash", type: "rect" as const, x: 0, y: 460, width: 1080, height: 70, fill: "paper", opacity: 0.92 },
    { id: "name", type: "text" as const, field: "fullName", x: 540, y: 560, width: 920, fontFamily: opts.heading, fontSize: 50, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "role", type: "text" as const, field: "roleLine", x: 540, y: 640, width: 880, fontFamily: opts.body, fontSize: 20, fill: "accent", textAnchor: "middle" as const, maxLines: 2 },
    { id: "personal", type: "text" as const, field: "personalLine", x: 540, y: 710, width: 880, fontFamily: opts.body, fontSize: 16, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "line", type: "line" as const, x: 360, y: 760, width: 360, stroke: "line", strokeWidth: 1 },
    { id: "education", type: "text" as const, field: "bioEducationBlock", x: 540, y: 820, width: 900, fontFamily: opts.body, fontSize: 16, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "family", type: "text" as const, field: "bioFamilyBlock", x: 540, y: 890, width: 900, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "about", type: "text" as const, field: "about", x: 540, y: 980, width: 860, fontFamily: opts.body, fontSize: 18, fill: "ink", textAnchor: "middle" as const, maxLines: 4, lineHeight: 1.4 },
    { id: "expectations", type: "text" as const, field: "bioExpectationsBlock", x: 540, y: 1140, width: 860, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "lifestyle", type: "text" as const, field: "bioLifestyleBlock", x: 540, y: 1210, width: 860, fontFamily: opts.body, fontSize: 15, fill: "muted", textAnchor: "middle" as const, maxLines: 2 },
    { id: "contact", type: "text" as const, field: "contactLine", x: 540, y: 1280, width: 800, fontFamily: opts.body, fontSize: 16, fill: "ink", textAnchor: "middle" as const, maxLines: 2 },
    { id: "qr", type: "qr" as const, field: "qrUrl", x: 495, y: 1340, width: 90, height: 90 },
  ];
}

export function profileCard(opts: {
  id: string;
  name: string;
  category: string;
  cardTypes: CardTypeId[];
  palette: Palette;
  heading: string;
  body: string;
  layout?: CardLayout;
  /** Auspicious / faith motif centered at top of Bio Data sheets. */
  blessing?: MotifKind;
  /** When false, Bio Data sheet omits the portrait photo block. Default true. */
  withPhoto?: boolean;
}): TemplateDefinition {
  const colors = opts.palette;
  const layout = opts.layout ?? "portrait";
  const sheetOpts = {
    heading: opts.heading,
    body: opts.body,
    blessing: opts.blessing,
    withPhoto: opts.withPhoto,
  };
  const elements =
    layout === "split"
      ? splitCardElements(opts)
      : layout === "folio"
        ? folioCardElements(opts)
        : layout === "circle"
          ? circleCardElements(opts)
          : layout === "biodata-classic"
            ? biodataClassicCardElements(sheetOpts)
            : layout === "biodata-sidebar"
              ? biodataSidebarCardElements(opts)
              : layout === "biodata-columns"
                ? biodataColumnsCardElements(opts)
                : layout === "biodata-modern"
                  ? biodataModernCardElements(opts)
                  : layout === "biodata-arch"
                    ? biodataArchCardElements(opts)
                    : layout === "biodata-garland"
                      ? biodataGarlandCardElements(opts)
                      : layout === "biodata-gold"
                        ? biodataGoldCardElements(opts)
                        : layout === "biodata-compact"
                          ? biodataCompactCardElements({
                              heading: opts.heading,
                              body: opts.body,
                              blessing: opts.blessing,
                              withPhoto: opts.withPhoto,
                            })
                          : layout === "bio-spaced"
                            ? bioSpacedCardElements(opts)
                            : layout === "bio-editorial"
                              ? bioEditorialCardElements(opts)
                              : layout === "bio-split"
                                ? bioSplitCardElements(opts)
                                : portraitCardElements(opts);

  return {
    id: opts.id,
    name: opts.name,
    kind: "card",
    eventTypes: [],
    cardTypes: opts.cardTypes,
    category: opts.category,
    tags: [opts.category, "card", layout, ...(opts.cardTypes.includes("bio") ? ["biodata", "bio"] : [])],
    orientation: "portrait",
    dimensions: PORTRAIT,
    background: { type: "solid", colors: [colors.paper] },
    fonts: { heading: opts.heading, body: opts.body },
    colors,
    fields: cardFields(opts.cardTypes[0]),
    previewHint: opts.name,
    license: LICENSE,
    elements,
  };
}
