import { THEMES } from "@/config/themes";
import { cn } from "@/lib/cn";
import type { ThemeId } from "@/types";

type Props = {
  value?: ThemeId;
  onChange: (theme: ThemeId) => void;
};

export function ThemePicker({ value = "classic", onChange }: Props) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Theme</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition",
              value === theme.id ? "border-gold bg-cream-dark ring-2 ring-gold/30" : "border-stone-200 bg-white hover:border-stone-300",
            )}
          >
            <span
              className="mb-2 flex h-8 overflow-hidden rounded-md"
              aria-hidden
            >
              <span className="flex-1" style={{ background: theme.overlay.paper ?? "#f7f1e8" }} />
              <span className="w-3" style={{ background: theme.overlay.accent ?? "#b8956a" }} />
              <span className="w-3" style={{ background: theme.overlay.ink ?? "#1c1917" }} />
            </span>
            <span className="text-sm font-medium text-ink">{theme.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
