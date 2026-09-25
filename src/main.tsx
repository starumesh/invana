import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
import { App } from "@/App";
import { AuthSessionProvider } from "@/auth/AuthSession";
import { initAnalytics } from "@/lib/analytics";
import "@/index.css";

/** Migrate old HashRouter links (/#/path) to path URLs (/path). */
function migrateHashRoute() {
  const { hash, pathname, search } = window.location;
  if (!hash.startsWith("#/")) return;
  const next = hash.slice(1) + (search && !hash.includes("?") ? search : "");
  if (pathname === "/" || pathname === "") {
    window.history.replaceState(null, "", next || "/");
  }
}

migrateHashRoute();
initAnalytics();

/** Data router so BuilderPage can use `useBlocker` for unsaved-change prompts. */
const router = createBrowserRouter(createRoutesFromElements(<Route path="*" element={<App />} />));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthSessionProvider>
      <RouterProvider router={router} />
    </AuthSessionProvider>
  </StrictMode>,
);
