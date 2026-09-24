import { useState } from "react";
import { ShareIcon } from "@/components/ui/Icons";

type Props = {
  eventTitle: string;
};

export function InviteShareHint({ eventTitle }: Props) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = eventTitle || "You're invited";
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, url, text: `You're invited to ${title}` });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        /* guest dismissed share sheet or clipboard blocked */
      }
    }
  }

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-stone-200/70 bg-white/80 shadow-soft backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
        <div className="max-w-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-gold-dark">Share</p>
          <p className="mt-2 font-serif text-2xl text-ink">Passing this along?</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Share the invite link with family and friends who should be here too.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onShare()}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-gold/40 bg-cream px-6 text-sm font-medium text-ink transition hover:border-gold hover:bg-white"
        >
          <ShareIcon className="h-4 w-4 text-gold-dark" />
          {copied ? "Link copied" : "Share invite"}
        </button>
      </div>
    </div>
  );
}
