import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isValidLatLng, mapProvider, round6, type LatLng } from "@/lib/maps";

type Props = {
  /** Single source of truth for both the marker and the map center. */
  value: LatLng | null;
  onChange?: (next: LatLng) => void;
  height?: number;
  label: string;
};

const PIN = L.divIcon({
  className: "",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  html: '<svg viewBox="0 0 24 32" width="30" height="40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0z" fill="#8c6d45"/><circle cx="12" cy="11.5" r="4.5" fill="#faf7f2"/></svg>',
});

const OVERVIEW: LatLng = { lat: 22.5, lng: 79 };

export function LocationMap({ value, onChange, height = 300, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const interactive = Boolean(onChange);
  const invalid = value !== null && !isValidLatLng(value);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      center: [OVERVIEW.lat, OVERVIEW.lng],
      zoom: 4,
      scrollWheelZoom: interactive ? "center" : false,
      dragging: true,
      tap: true,
      attributionControl: true,
    } as L.MapOptions);
    L.tileLayer(mapProvider.tileUrlTemplate, { maxZoom: 19, attribution: mapProvider.attribution }).addTo(m);
    if (interactive) {
      m.on("click", (e: L.LeafletMouseEvent) => onChangeRef.current?.({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) }));
    }
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value || !isValidLatLng(value)) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const ll = L.latLng(value.lat, value.lng);
    if (!marker.current) {
      marker.current = L.marker(ll, { icon: PIN, draggable: interactive, keyboard: false, title: label }).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        onChangeRef.current?.({ lat: round6(p.lat), lng: round6(p.lng) });
      });
    } else {
      marker.current.setLatLng(ll);
    }
    m.setView(ll, Math.max(m.getZoom(), 16), { animate: false });
  }, [value?.lat, value?.lng, interactive, label]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <div
        ref={el}
        role={interactive ? "application" : "img"}
        aria-label={
          interactive
            ? `${label}. Click or tap the map to place the pin; drag the pin to adjust.${isValidLatLng(value) ? ` Pin at ${value.lat}, ${value.lng}.` : " No pin placed yet."}`
            : `${label}${isValidLatLng(value) ? ` at ${value.lat}, ${value.lng}` : ""}`
        }
        className="z-0 w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"
        style={{ height }}
      />
      {invalid ? (
        <div role="alert" className="absolute inset-0 z-[500] flex items-center justify-center rounded-2xl bg-white/90 p-6 text-center text-sm text-red-800">
          Unable to display this location. Please select the location again.
        </div>
      ) : null}
      {interactive ? (
        <button
          type="button"
          onClick={() => {
            const c = map.current?.getCenter();
            if (c) onChangeRef.current?.({ lat: round6(c.lat), lng: round6(c.lng) });
          }}
          className="absolute bottom-3 left-3 z-[500] rounded-full border border-stone-300 bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-cream focus:outline-none focus-visible:ring-4 focus-visible:ring-gold/40"
        >
          Pin map center
        </button>
      ) : null}
    </div>
  );
}
