import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "gold";
  size?: "sm" | "md";
};

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition duration-200 active:scale-[0.98] disabled:opacity-50",
        size === "sm" ? "px-3.5 py-2 text-sm" : "px-5 py-2.5 text-sm",
        variant === "primary" && "bg-ink text-cream hover:bg-stone-800",
        variant === "gold" && "bg-gold text-ink shadow-soft hover:bg-gold-dark",
        variant === "secondary" && "border border-stone-300 bg-white text-ink hover:border-stone-400 hover:bg-cream",
        variant === "ghost" && "text-ink-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
