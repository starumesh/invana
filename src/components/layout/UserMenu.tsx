import { useEffect, useId, useRef, useState } from "react";

type Props = {
  email: string;
  onSignOut: () => void;
};

function initialFromEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export function UserMenu({ email, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const letter = initialFromEmail(email);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-medium text-cream transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={email}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span aria-hidden>{letter}</span>
        <span className="sr-only">Account menu for {email}</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-soft"
        >
          <div className="border-b border-stone-100 px-3.5 py-2.5">
            <p className="truncate text-xs text-ink-muted">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-medium text-ink">{email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3.5 py-2.5 text-left text-sm text-ink transition hover:bg-cream"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
