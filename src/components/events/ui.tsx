import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { EventStatus, PassStatus, GuestStatus } from "@event-core";
import { Button } from "@/components/ui/Button";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { cn } from "@/lib/cn";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-stone-100 text-stone-700 ring-stone-300",
  PUBLISHED: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  CANCELLED: "bg-red-50 text-red-800 ring-red-300",
  COMPLETED: "bg-sky-50 text-sky-800 ring-sky-300",
  ISSUED: "bg-amber-50 text-amber-900 ring-amber-300",
  CHECKED_IN: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  INVITED: "bg-amber-50 text-amber-900 ring-amber-300",
  NO_PASS: "bg-stone-100 text-stone-600 ring-stone-300",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  ISSUED: "Pass issued",
  CHECKED_IN: "Checked in",
  INVITED: "Invited",
  NO_PASS: "No pass yet",
};

export function StatusBadge({ status, className }: { status: EventStatus | PassStatus | GuestStatus | "NO_PASS"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT,
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "gold" | "green" }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className={cn("mt-1.5 font-serif text-3xl", tone === "green" && "text-emerald-700", tone === "gold" && "text-gold-dark")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string; required?: boolean }) => ReactNode;
};

/** Label + control + accessible hint/error wiring. */
export function FormField({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
        {label}
        {required ? <span aria-hidden className="text-gold-dark"> *</span> : null}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy, required })}
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry ? (
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warn" }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "info" && "border-stone-200 bg-white text-ink-muted",
      )}
    >
      {children}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white/70 px-6 py-14 text-center" role="status" aria-live="polite">
      <div className="mx-auto h-9 w-9 rounded-full border-2 border-gold/40 border-t-gold animate-soft-pulse" />
      <p className="mt-4 text-ink-muted">{label}</p>
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-ink-muted">
          {value} / {max} generated
        </span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-gold transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-cream p-6 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-serif text-2xl text-ink">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-ink-muted">{body}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button ref={cancelRef} type="button" size="sm" variant="secondary" onClick={onCancel}>
            Keep it
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Events run only against the Supabase backend — there is no browser-local mode. */
export function RequireSupabase({ children }: { children: ReactNode }) {
  if (isSupabaseConfigured()) return <>{children}</>;
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-3xl">Events need the Invana backend</h1>
      <p className="mt-3 text-ink-muted">
        Event management, passes, and check-in run on Supabase only. Set <code>VITE_SUPABASE_URL</code> and{" "}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, apply the event migrations, and deploy the <code>event-management</code> function.
      </p>
    </main>
  );
}

export function SignInRequired() {
  const location = useLocation();
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-3xl">Sign in to manage events</h1>
      <p className="mt-3 text-ink-muted">Events, guest passes, and check-in are tied to your account so only you and your staff can access them.</p>
      <Link to="/signin" state={{ from: `${location.pathname}${location.search}` }} className={buttonClassName("gold", "md", "mt-6")}>
        Sign in
      </Link>
    </main>
  );
}

export function EventSubNav({ eventId, access = "ORGANIZER" }: { eventId: string; access?: "ORGANIZER" | "STAFF" }) {
  const tabs =
    access === "STAFF"
      ? [{ to: `/events/${eventId}/check-in`, label: "Check-in" }]
      : [
          { to: `/events/${eventId}/manage`, label: "Overview" },
          { to: `/events/${eventId}/guests`, label: "Guests" },
          { to: `/events/${eventId}/passes`, label: "Passes" },
          { to: `/events/${eventId}/check-in`, label: "Check-in" },
          { to: `/events/${eventId}/attendance`, label: "Attendance" },
        ];
  return (
    <nav aria-label="Event sections" className="-mx-4 mt-6 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 rounded-full border border-stone-200 bg-white p-1 text-sm">
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "block rounded-full px-4 py-2 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-gold/30",
                  isActive ? "bg-ink text-cream" : "text-ink-muted hover:text-ink",
                )
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs uppercase tracking-[0.18em] text-gold-dark">{eyebrow}</p> : null}
        <h1 ref={ref} tabIndex={-1} className="mt-1 font-serif text-3xl outline-none sm:text-4xl">
          {title}
        </h1>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
