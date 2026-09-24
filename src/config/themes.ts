import type { ThemeId } from "@/types";

export type ThemePreset = {
  id: ThemeId;
  name: string;
  overlay: Record<string, string>;
};

export const THEMES: ThemePreset[] = [
  { id: "classic", name: "Classic", overlay: {} },
  {
    id: "elegant",
    name: "Elegant",
    overlay: { paper: "#f7f1e8", ink: "#2c241b", accent: "#9c7a4a", muted: "#7a6a58" },
  },
  {
    id: "royal",
    name: "Royal",
    overlay: { paper: "#14110f", ink: "#f3e6c5", accent: "#d4af37", muted: "#c9b896" },
  },
  {
    id: "modern",
    name: "Modern",
    overlay: { paper: "#f4f1ec", ink: "#171717", accent: "#44403c", muted: "#737373" },
  },
  {
    id: "minimal",
    name: "Minimal",
    overlay: { paper: "#ffffff", ink: "#111111", accent: "#525252", muted: "#737373" },
  },
  {
    id: "festive",
    name: "Festive",
    overlay: { paper: "#fff7ed", ink: "#7c2d12", accent: "#c2410c", muted: "#9a3412" },
  },
];

export function themeOverlay(id?: ThemeId): Record<string, string> {
  return THEMES.find((theme) => theme.id === id)?.overlay ?? {};
}
