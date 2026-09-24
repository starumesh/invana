import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "@/App";
import { AuthSessionProvider } from "@/auth/AuthSession";
import { initAnalytics } from "@/lib/analytics";
import "@/index.css";

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AuthSessionProvider>
        <App />
      </AuthSessionProvider>
    </HashRouter>
  </StrictMode>,
);
