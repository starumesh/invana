import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Relative base so the build works on GitHub Pages project pages (/<repo>/)
// and custom domains alike without hardcoding a repo name. Routing uses
// HashRouter, so deep links resolve without a server-side 404 fallback.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
