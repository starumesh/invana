/**
 * Map provider abstraction. The default uses OpenStreetMap tiles + Nominatim geocoding
 * (no API key, no SDK). Swap `mapProvider` to change vendors without touching pages.
 */
export type LatLng = { lat: number; lng: number };

export type GeocodeResult = LatLng & {
  label: string;
  city?: string;
  state?: string;
  country?: string;
};

export interface MapProvider {
  readonly attribution: string;
  tileUrl(x: number, y: number, z: number): string;
  /** Deep link that opens the platform maps app / site at the pin. */
  openInMapsUrl(point: LatLng, label?: string): string;
  geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>;
}

export const TILE_SIZE = 256;

export function lngLatToWorld(point: LatLng, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((point.lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export function worldToLngLat(x: number, y: number, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

type NominatimRow = {
  lat: string;
  lon: string;
  display_name: string;
  address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
};

export const osmProvider: MapProvider = {
  attribution: "© OpenStreetMap contributors",
  tileUrl(x, y, z) {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  },
  openInMapsUrl(point, label) {
    const q = `${point.lat},${point.lng}`;
    const query = label ? `${q} (${label})` : q;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  },
  async geocode(query, signal) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Address search is unavailable right now. Drop the pin on the map instead.");
    const rows = (await res.json()) as NominatimRow[];
    return rows.map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lon),
      label: r.display_name,
      city: r.address?.city ?? r.address?.town ?? r.address?.village,
      state: r.address?.state,
      country: r.address?.country,
    }));
  },
};

export const mapProvider: MapProvider = osmProvider;

export function openInMapsUrl(point: LatLng, label?: string): string {
  return mapProvider.openInMapsUrl(point, label);
}
