/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', '"Cormorant Garamond"', "Georgia", "serif"],
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        script: ['"Great Vibes"', "cursive"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#1c1917",
          muted: "#57534e",
          faint: "#a8a29e",
        },
        cream: {
          DEFAULT: "#faf7f2",
          dark: "#f3ebe0",
          deeper: "#e8dccb",
        },
        gold: {
          DEFAULT: "#b8956a",
          dark: "#8c6d45",
          light: "#d4b896",
        },
      },
      boxShadow: {
        card: "0 18px 50px -24px rgba(28, 25, 23, 0.35)",
        soft: "0 10px 30px -18px rgba(28, 25, 23, 0.28)",
        lift: "0 28px 60px -28px rgba(28, 25, 23, 0.42)",
      },
    },
  },
  plugins: [],
};
