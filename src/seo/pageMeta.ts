import { EVENT_TYPES, getEventType } from "@/config/event-types";
import { CANONICAL_SITE_URL, publicOrigin } from "@/lib/url";
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
  "digital invitations, online invitation, wedding invitation, birthday invitation, event invite, invitation card, bio data, biodata, marriage biodata, matrimony bio data, bio data format, create invitation online, free invitation maker, WhatsApp invitation, RSVP online, Invana";

export const DEFAULT_META: PageMeta = {
  title: "Invana — Free Digital Invitations & Bio Data Cards Online",
  description:
    "Create free digital invitations and marriage bio data cards online. Wedding, birthday, and event invites with RSVP — plus classic biodata sheets you can download and share on WhatsApp.",
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

/** Absolute URL for the current path (share/OG/canonical). */
export function currentCanonicalUrl(): string {
  const origin = publicOrigin() || CANONICAL_SITE_URL;
  if (typeof window === "undefined") return `${origin}/`;
  const path = window.location.pathname || "/";
  const search = window.location.search || "";
  return `${origin}${path}${search}`;
}

export function applyPageMeta(meta: PageMeta) {
  const title = meta.title;
  const description = meta.description;
  const keywords = meta.keywords ?? DEFAULT_KEYWORDS;
  const type = meta.type ?? "website";
  const url = currentCanonicalUrl();
  const origin = publicOrigin() || CANONICAL_SITE_URL;
  const image = meta.image || `${origin}/og-default.svg`;

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
  setMeta("property", "og:locale", "en_IN");

  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);

  if (meta.noIndex) {
    setLink("canonical", url);
  } else {
    const path = typeof window !== "undefined" ? window.location.pathname || "/" : "/";
    setLink("canonical", `${origin}${path === "/" ? "/" : path}`);
  }
}

export function metaForPath(pathname: string): PageMeta {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/") return DEFAULT_META;

  if (path === "/templates") {
    return {
      title: `Invitation & Bio Data Templates | ${SITE_NAME}`,
      description:
        "Browse free wedding invitation, birthday invite, event invite, and marriage bio data templates. Pick a look and personalize your online invitation or biodata card.",
      keywords: `${DEFAULT_KEYWORDS}, invitation templates, biodata templates, bio data templates`,
    };
  }

  if (path === "/create") {
    return {
      title: `Create Digital Invitation Online Free | ${SITE_NAME}`,
      description:
        "Design a free digital invitation for weddings, birthdays, and every occasion. Choose a template, personalize, then download or share your event invite on WhatsApp.",
      keywords: `${DEFAULT_KEYWORDS}, create invitation, wedding invitation online, free invitation maker`,
    };
  }

  if (path === "/create/card") {
    return {
      title: `Create Bio Data / Biodata Card Online Free | ${SITE_NAME}`,
      description:
        "Make a classic marriage bio data (biodata) sheet online — personal, family, and contact sections. Download PNG or PDF and share for matrimony.",
      keywords: `${DEFAULT_KEYWORDS}, create biodata, marriage biodata, bio data format, bio data online`,
    };
  }

  const createEvent = path.match(/^\/create\/([^/]+)$/);
  if (createEvent && EVENT_IDS.has(createEvent[1] as EventTypeId)) {
    const meta = getEventType(createEvent[1] as EventTypeId);
    return {
      title: `Create ${meta.name} Invitation Online | ${SITE_NAME}`,
      description: `Create a free ${meta.name.toLowerCase()} invitation online — customize your event invite, collect RSVPs, and share on WhatsApp with ${SITE_NAME}.`,
      keywords: `${DEFAULT_KEYWORDS}, ${meta.name.toLowerCase()} invitation, ${meta.name.toLowerCase()} invite`,
    };
  }

  if (path.startsWith("/builder/")) {
    return {
      title: `Invitation Builder | ${SITE_NAME}`,
      description:
        "Edit your digital invitation or bio data card with live preview. Adjust details, theme, and export PNG or PDF.",
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
      keywords: `${DEFAULT_KEYWORDS}, online RSVP, digital invitation link`,
      type: "article",
    };
  }

  return DEFAULT_META;
}
