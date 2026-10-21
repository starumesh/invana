/** Web fonts loaded in `index.html` plus safe system fallbacks for matching. */
export const FONT_MATCH_CANDIDATES = [
  { id: "playfair", label: "Playfair Display", fontFamily: '"Playfair Display", Georgia, serif' },
  { id: "cormorant", label: "Cormorant Garamond", fontFamily: '"Cormorant Garamond", Georgia, serif' },
  { id: "great-vibes", label: "Great Vibes (script)", fontFamily: '"Great Vibes", "Brush Script MT", cursive' },
  { id: "noto-serif-telugu", label: "Noto Serif Telugu", fontFamily: '"Noto Serif Telugu", "Noto Sans Telugu", serif' },
  { id: "noto-sans-telugu", label: "Noto Sans Telugu", fontFamily: '"Noto Sans Telugu", sans-serif' },
  { id: "georgia", label: "Georgia", fontFamily: 'Georgia, "Times New Roman", serif' },
  { id: "times", label: "Times New Roman", fontFamily: '"Times New Roman", Times, serif' },
  { id: "inter", label: "Inter (sans)", fontFamily: 'Inter, system-ui, sans-serif' },
  { id: "palatino", label: "Palatino", fontFamily: '"Palatino Linotype", Palatino, Georgia, serif' },
  { id: "garamond", label: "Garamond", fontFamily: 'Garamond, "Times New Roman", serif' },
  { id: "cursive", label: "Script (system)", fontFamily: '"Segoe Script", "Brush Script MT", cursive' },
] as const;

export const FONT_SUGGESTIONS = FONT_MATCH_CANDIDATES.map((c) => ({
  id: c.id,
  label: c.label,
  value: c.fontFamily,
}));
