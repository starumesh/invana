import { Link } from "react-router-dom";

export function InviteBrandFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-stone-200/80">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #f3ebe0 0%, #ebe0d0 55%, #e0d2bc 100%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 py-14 text-center">
        <p className="font-serif text-2xl tracking-tight text-ink">Invana</p>
        <div className="mx-auto mt-4 h-px w-12 bg-gradient-to-r from-transparent via-gold/60 to-transparent" aria-hidden />
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
          Digital invitations that feel like keepsakes — designed to be shared with care.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-xs uppercase tracking-[0.18em] text-gold-dark underline-offset-4 transition hover:underline"
        >
          Create your own
        </Link>
      </div>
    </footer>
  );
}
