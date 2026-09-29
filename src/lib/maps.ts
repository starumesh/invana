/**
 * Map provider abstraction. Default: OpenStreetMap tiles, Photon (komoot) search with a
 * Nominatim fallback — no API key or SDK. Swap `mapProvider` to change vendors.
 */
export type LatLng = { lat: number; lng: number };

/** Normalized venue location stored with the event. */
export type NormalizedLocation = LatLng & { address?: string; mapUrl?: string };

export type GeocodeResult = LatLng & {
  name: string;
  label: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
};

export interface MapProvider {
  readonly attribution: string;
  readonly tileUrlTemplate: string;
  openInMapsUrl(point: LatLng): string;
  geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>;
  reverse(point: LatLng, signal?: AbortSignal): Promise<GeocodeResult | null>;
}

export function isValidLatLng(p: { lat?: unknown; lng?: unknown } | null | undefined): p is LatLng {
  if (!p) return false;
  const { lat, lng } = p as { lat: unknown; lng: unknown };
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function pair(a: string, b: string): LatLng | null {
  const lat = Number(a);
  const lng = Number(b);
  const p = { lat: round6(lat), lng: round6(lng) };
  return isValidLatLng(p) ? p : null;
}

export type ParsedLocationInput =
  | { kind: "point"; point: LatLng; mapUrl?: string; query?: string }
  | { kind: "query"; query: string; mapUrl?: string }
  | { kind: "short-link"; mapUrl: string }
  | { kind: "text"; text: string };

/**
 * Understand what the organizer typed or pasted:
 * "17.385044, 78.486671", Google Maps URLs (@lat,lng / ?q= / query= / !3d!4d / ll=),
 * OpenStreetMap / Apple Maps links, geo: URIs, or plain text to search.
 * Always returns latitude first (north/south), longitude second (east/west).
 */
export function parseLocationInput(raw: string): ParsedLocationInput {
  const text = raw.trim();
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const plain = new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`).exec(text);
  if (plain) {
    const p = pair(plain[1], plain[2]);
    if (p) return { kind: "point", point: p };
  }
  const geo = new RegExp(`^geo:${num},${num}`, "i").exec(text);
  if (geo) {
    const p = pair(geo[1], geo[2]);
    if (p) return { kind: "point", point: p };
  }
  if (!/^https?:\/\//i.test(text)) return { kind: "text", text };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { kind: "text", text };
  }
  const host = url.hostname.toLowerCase();
  if (/^(maps\.app\.goo\.gl|goo\.gl|g\.co)$/.test(host)) return { kind: "short-link", mapUrl: text };

  const decoded = decodeURIComponent(url.href);
  // Google place pin (most precise): !3d<lat>!4d<lng>
  const bang = new RegExp(`!3d${num}!4d${num}`).exec(decoded);
  if (bang) {
    const p = pair(bang[1], bang[2]);
    if (p) return { kind: "point", point: p, mapUrl: text };
  }
  for (const key of ["q", "query", "ll", "destination", "daddr", "center", "sll", "mlat"]) {
    const v = url.searchParams.get(key);
    if (!v) continue;
    if (key === "mlat") {
      const p = pair(v, url.searchParams.get("mlon") ?? "");
      if (p) return { kind: "point", point: p, mapUrl: text };
      continue;
    }
    const m = new RegExp(`^\\s*${num}\\s*,\\s*${num}`).exec(v);
    if (m) {
      const p = pair(m[1], m[2]);
      if (p) return { kind: "point", point: p, mapUrl: text };
    }
  }
  // Viewport center: /@lat,lng,zoom  (Google) or #map=zoom/lat/lng (OSM)
  const at = new RegExp(`@${num},${num}`).exec(decoded);
  if (at) {
    const p = pair(at[1], at[2]);
    if (p) return { kind: "point", point: p, mapUrl: text };
  }
  const osm = new RegExp(`#map=\\d+/${num}/${num}`).exec(decoded);
  if (osm) {
    const p = pair(osm[1], osm[2]);
    if (p) return { kind: "point", point: p, mapUrl: text };
  }
  // Place/search links without coordinates: search by the place name.
  const place = /\/maps\/(?:place|search)\/([^/@?]+)/.exec(url.pathname);
  const q = url.searchParams.get("q") ?? url.searchParams.get("query") ?? (place ? place[1].replace(/\+/g, " ") : "");
  if (q) return { kind: "query", query: decodeURIComponent(q), mapUrl: text };
  return { kind: "text", text };
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    locality?: string;
    state?: string;
    country?: string;
  };
};

const clean = (v?: string) => v?.replace(/[\s,]+$/g, "").replace(/^[\s,]+/g, "").trim() || undefined;

function fromPhoton(f: PhotonFeature): GeocodeResult {
  const raw = f.properties;
  const p = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? clean(v) : v])) as PhotonFeature["properties"];
  const [lng, lat] = f.geometry.coordinates;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const city = p.city ?? p.district ?? p.locality;
  const name = p.name ?? street ?? city ?? "Selected location";
  return {
    lat: round6(lat),
    lng: round6(lng),
    name,
    label: Array.from(new Set([name, street, p.locality, city, p.state, p.country].filter(Boolean))).join(", "),
    street: Array.from(new Set([street, p.locality].filter(Boolean))).join(", ") || undefined,
    city,
    state: p.state,
    country: p.country,
  };
}

type NominatimRow = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: { road?: string; suburb?: string; city?: string; town?: string; village?: string; state?: string; country?: string };
};

function fromNominatim(r: NominatimRow): GeocodeResult {
  const city = r.address?.city ?? r.address?.town ?? r.address?.village;
  return {
    lat: round6(Number(r.lat)),
    lng: round6(Number(r.lon)),
    name: r.name || r.display_name.split(",")[0],
    label: r.display_name,
    street: [r.address?.road, r.address?.suburb].filter(Boolean).join(", ") || undefined,
    city,
    state: r.address?.state,
    country: r.address?.country,
  };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const osmProvider: MapProvider = {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  tileUrlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  openInMapsUrl(point) {
    return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
  },
  async geocode(query, signal) {
    const q = query.trim();
    if (!q) return [];
    try {
      const photon = await getJson<{ features: PhotonFeature[] }>(
        `https://photon.komoot.io/api/?limit=6&lang=en&q=${encodeURIComponent(q)}`,
        signal,
      );
      const rows = photon.features.map(fromPhoton).filter(isValidLatLng);
      if (rows.length) return rows;
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
    }
    const rows = await getJson<NominatimRow[]>(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`,
      signal,
    ).catch((err) => {
      if ((err as Error).name === "AbortError") throw err;
      throw new Error("Location search is unavailable right now. Tap the map to place the pin instead.");
    });
    return rows.map(fromNominatim).filter(isValidLatLng);
  },
  async reverse(point, signal) {
    try {
      const photon = await getJson<{ features: PhotonFeature[] }>(
        `https://photon.komoot.io/reverse?lang=en&lat=${point.lat}&lon=${point.lng}`,
        signal,
      );
      const f = photon.features[0];
      return f ? { ...fromPhoton(f), lat: point.lat, lng: point.lng } : null;
    } catch {
      return null;
    }
  },
};

export const mapProvider: MapProvider = osmProvider;

export function openInMapsUrl(point: LatLng): string {
  return mapProvider.openInMapsUrl(point);
}
