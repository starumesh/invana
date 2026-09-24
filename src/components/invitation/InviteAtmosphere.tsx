import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Deeper cream band for secondary content areas */
  tone?: "hero" | "band";
};

const PATTERN =
  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23b8956a' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

/**
 * Cream / gold atmosphere layer — fills barren voids without purple AI-slop gradients.
 */
export function InviteAtmosphere({ children, className = "", tone = "band" }: Props) {
  const gradient =
    tone === "hero"
      ? "radial-gradient(ellipse 75% 55% at 12% 18%, #e8d5b8 0%, transparent 55%), radial-gradient(ellipse 60% 45% at 92% 8%, #f0e2d0 0%, transparent 50%), linear-gradient(165deg, #faf7f2 0%, #f3ebe0 52%, #ebe0d0 100%)"
      : "radial-gradient(ellipse 70% 50% at 80% 0%, #e8d5b888 0%, transparent 50%), radial-gradient(ellipse 55% 40% at 10% 90%, #d4b89644 0%, transparent 45%), linear-gradient(180deg, #f3ebe0 0%, #faf7f2 40%, #ebe0d0 100%)";

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0" style={{ background: gradient }} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: PATTERN }}
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}
