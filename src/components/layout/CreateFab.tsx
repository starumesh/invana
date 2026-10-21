import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { to: "/create", label: "Create an invitation", hint: "Pick an occasion, customize, and share" },
  { to: "/personalize", label: "Upload Invitation & Personalize", hint: "PNG, JPG, or PDF — update your details" },
  { to: "/events/create", label: "Create an Event", hint: "Passes, guests, and check-in" },
] as const;

export function CreateFab() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          className="w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-lift"
          role="menu"
          aria-label="Create options"
        >
          <p className="border-b border-stone-100 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            Create
          </p>
          <ul className="py-1">
            {OPTIONS.map((opt) => (
              <li key={opt.to}>
                <Link
                  to={opt.to}
                  role="menuitem"
                  className="block px-4 py-3 transition hover:bg-cream-dark/60"
                  onClick={() => setOpen(false)}
                >
                  <span className="block text-sm font-medium text-ink">{opt.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{opt.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Close create menu" : "Open create menu"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-gold text-lg font-semibold text-white shadow-lift transition",
          "hover:bg-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        )}
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}
