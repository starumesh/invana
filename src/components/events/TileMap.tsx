import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { lngLatToWorld, mapProvider, TILE_SIZE, worldToLngLat, type LatLng } from "@/lib/maps";

type Props = {
  value: LatLng | null;
  onChange?: (next: LatLng) => void;
  height?: number;
  label: string;
  /** Initial view when no pin is set. */
  fallbackCenter?: LatLng;
};

const MIN_ZOOM = 2;
const MAX_ZOOM = 18;

/**
 * Dependency-free slippy map. Interactive when `onChange` is set: click/tap to drop the pin,
 * drag to pan, +/- to zoom, arrow keys nudge the pin (keyboard accessible).
 */
export function TileMap({ value, onChange, height = 280, label, fallbackCenter = { lat: 20.5937, lng: 78.9629 } }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [zoom, setZoom] = useState(value ? 15 : 4);
  const [center, setCenter] = useState<LatLng>(value ?? fallbackCenter);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const interactive = Boolean(onChange);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lastValue = useRef<string>("");
  useEffect(() => {
    const key = value ? `${value.lat},${value.lng}` : "";
    if (value && key !== lastValue.current) {
      setCenter(value);
      if (!lastValue.current) setZoom((z) => Math.max(z, 14));
    }
    lastValue.current = key;
  }, [value]);

  const c = lngLatToWorld(center, zoom);
  const left = c.x - width / 2;
  const top = c.y - height / 2;
  const n = 2 ** zoom;
  const tiles: { key: string; x: number; y: number; src: string }[] = [];
  for (let tx = Math.floor(left / TILE_SIZE); tx <= Math.floor((left + width) / TILE_SIZE); tx += 1) {
    for (let ty = Math.floor(top / TILE_SIZE); ty <= Math.floor((top + height) / TILE_SIZE); ty += 1) {
      if (ty < 0 || ty >= n) continue;
      const wrapped = ((tx % n) + n) % n;
      tiles.push({ key: `${zoom}/${tx}/${ty}`, x: tx * TILE_SIZE - left, y: ty * TILE_SIZE - top, src: mapProvider.tileUrl(wrapped, ty, zoom) });
    }
  }
  const pin = value ? lngLatToWorld(value, zoom) : null;

  const pointToLngLat = useCallback(
    (clientX: number, clientY: number) => {
      const rect = ref.current!.getBoundingClientRect();
      return worldToLngLat(left + (clientX - rect.left), top + (clientY - rect.top), zoom);
    },
    [left, top, zoom],
  );

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    if (d.moved) setCenter(worldToLngLat(d.cx - dx, d.cy - dy, zoom));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && onChange) onChange(pointToLngLat(e.clientX, e.clientY));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = 20;
    const base = value ?? center;
    const w = lngLatToWorld(base, zoom);
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
    if (moves[e.key] && onChange) {
      e.preventDefault();
      const next = worldToLngLat(w.x + moves[e.key][0], w.y + moves[e.key][1], zoom);
      onChange(next);
      setCenter(next);
    } else if (e.key === "+" || e.key === "=") {
      setZoom((z) => Math.min(MAX_ZOOM, z + 1));
    } else if (e.key === "-") {
      setZoom((z) => Math.max(MIN_ZOOM, z - 1));
    } else if (e.key === "Enter" && onChange && !value) {
      onChange(center);
    }
  }

  return (
    <div
      ref={ref}
      role={interactive ? "application" : "img"}
      aria-label={
        interactive
          ? `${label}. Click or tap to place the pin. Arrow keys move the pin, plus and minus zoom.${value ? ` Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}.` : " No pin placed."}`
          : `${label}${value ? ` at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : ""}`
      }
      tabIndex={interactive ? 0 : -1}
      onKeyDown={interactive ? onKeyDown : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      className="relative w-full touch-none select-none overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 outline-none focus-visible:ring-4 focus-visible:ring-gold/40"
      style={{ height, cursor: interactive ? "crosshair" : "default" }}
    >
      {tiles.map((t) => (
        <img
          key={t.key}
          src={t.src}
          alt=""
          draggable={false}
          loading="lazy"
          className="pointer-events-none absolute max-w-none"
          style={{ left: t.x, top: t.y, width: TILE_SIZE, height: TILE_SIZE }}
        />
      ))}
      {pin ? (
        <svg
          aria-hidden
          viewBox="0 0 24 32"
          className="pointer-events-none absolute h-9 w-7 drop-shadow"
          style={{ left: pin.x - left - 14, top: pin.y - top - 36 }}
        >
          <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0z" fill="#8c6d45" />
          <circle cx="12" cy="11.5" r="4.5" fill="#faf7f2" />
        </svg>
      ) : null}
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
        <button type="button" aria-label="Zoom in" className="h-9 w-9 text-lg hover:bg-cream" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}>
          +
        </button>
        <button type="button" aria-label="Zoom out" className="h-9 w-9 border-t border-stone-200 text-lg hover:bg-cream" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}>
          −
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-1 right-2 rounded bg-white/80 px-1.5 text-[10px] text-ink-muted">{mapProvider.attribution}</p>
    </div>
  );
}
