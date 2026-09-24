import { EVENT_TYPES, getEventType } from "@/config/event-types";
import { publicOrigin } from "@/lib/url";
import type { EventTypeId } from "@/types";

export type PageMeta = {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  type?: "website" | "article";
  /** When true, discourage indexing (e.g. private builder drafts). */
  noIndex?: boolean;
};

export const SITE_NAME = "Invana";

export const DEFAULT_KEYWORDS =
  "digital invitations, wedding invitation, birthday invitation, event invite, online invitation card, bio data, biodata card, matrimony bio, personal bio card, RSVP, WhatsApp invite share, Invana";

export const DEFAULT_META: PageMeta = {
  title: "Invana — Digital invitations, cards & biodata",
  description:
    "Create premium digital invitations for weddings, birthdays, and every event, plus classic marriage biodata cards. Customize templates, collect RSVPs, and share on WhatsApp.",
  keywords: DEFAULT_KEYWORDS,
  type: "website",
};

const EVENT_IDS = new Set(EVENT_TYPES.map((t) => t.id));

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Absolute URL for the current hash route (share/OG). Hash URLs are weak for crawl SEO — see README. */
export function currentCanonicalUrl(): string {
  const origin = publicOrigin();
  if (typeof window === "undefined") return origin || "";
  const hash = window.location.hash || "#/";
  return `${origin}/${hash}`.replace(/([^:]\/)\/+/g, "$1");
}

export function applyPageMeta(meta: PageMeta) {
  const title = meta.title;
  const description = meta.description;
  const keywords = meta.keywords ?? DEFAULT_KEYWORDS;
  const type = meta.type ?? "website";
  const url = currentCanonicalUrl();
  const image = meta.image || `${publicOrigin()}/og-default.svg`;

  document.title = title;

  setMeta("name", "description", description);
  setMeta("name", "keywords", keywords);
  setMeta("name", "author", SITE_NAME);
  setMeta(
    "name",
    "robots",
    meta.noIndex ? "noindex, nofollow" : "index, follow",
  );

  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:type", type);
  setMeta("property", "og:url", url);
  setMeta("property", "og:image", image);

  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);

  // Prefer origin (no hash) as canonical so crawlers see a stable document URL.
  const origin = publicOrigin();
  if (origin) setLink("canonical", origin + "/");
}

export function metaForPath(pathname: string): PageMeta {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/") return DEFAULT_META;

  if (path === "/templates") {
    return {
      title: `Invitation & Bio Card Templates | ${SITE_NAME}`,
      description:
        "Browse wedding invitation, birthday invite, event invite, and classic marriage biodata templates. Pick a look and personalize your online invitation card.",
      keywords: `${DEFAULT_KEYWORDS}, invitation templates, biodata templates`,
    };
  }

  if (path === "/create") {
    return {
      title: `Create Digital Invitation | ${SITE_NAME}`,
      description:
        "Design a digital invitation for weddings, birthdays, and every occasion. Choose a template, personalize, then download or share your event invite.",
      keywords: `${DEFAULT_KEYWORDS}, create invitation, wedding invitation online`,
    };
  }

  if (path === "/create/card") {
    return {
      title: `Create Bio Data & Cards | ${SITE_NAME}`,
      description:
        "Build classic marriage biodata sheets and profile cards online. Personal, family, and contact sections ready to download and share.",
      keywords: `${DEFAULT_KEYWORDS}, create biodata, marriage biodata, Bio Data card`,
    };
  }

  const createEvent = path.match(/^\/create\/([^/]+)$/);
  if (createEvent && EVENT_IDS.has(createEvent[1] as EventTypeId)) {
    const meta = getEventType(createEvent[1] as EventTypeId);
    return {
      title: `Create ${meta.name} Invitation | ${SITE_NAME}`,
      description: `Create a ${meta.name.toLowerCase()} invitation online — customize your event invite, collect RSVPs, and share on WhatsApp with ${SITE_NAME}.`,
      keywords: `${DEFAULT_KEYWORDS}, ${meta.name.toLowerCase()} invitation, ${meta.name.toLowerCase()} invite`,
    };
  }

  if (path.startsWith("/builder/")) {
    return {
      title: `Invitation Builder | ${SITE_NAME}`,
      description:
        "Edit your digital invitation or bio card with live preview. Adjust details, theme, and export PNG or PDF.",
      keywords: DEFAULT_KEYWORDS,
      noIndex: true,
    };
  }

  if (path === "/dashboard") {
    return {
      title: `My Events | ${SITE_NAME}`,
      description:
        "Manage your digital invitations, biodata cards, RSVPs, and WhatsApp invite shares in one place.",
      keywords: DEFAULT_KEYWORDS,
      noIndex: true,
    };
  }

  if (path === "/signin") {
    return {
      title: `Sign in | ${SITE_NAME}`,
      description: `Sign in to ${SITE_NAME} to save drafts, download invitations, publish RSVP pages, and manage your events.`,
      keywords: DEFAULT_KEYWORDS,
      noIndex: true,
    };
  }

  if (path.startsWith("/invite/")) {
    return {
      title: `You're Invited | ${SITE_NAME}`,
      description:
        "View this event invitation online, check the details, and RSVP. Shared with Invana — digital invitations and WhatsApp invite links.",
      keywords: `${DEFAULT_KEYWORDS}, online RSVP`,
      type: "article",
    };
  }

  return DEFAULT_META;
}
