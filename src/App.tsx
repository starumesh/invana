import { Navigate, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { Shell } from "@/components/layout/Shell";
import { Seo } from "@/components/seo/Seo";
import { BuilderPage } from "@/pages/BuilderPage";
import { CreatePage } from "@/pages/CreatePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { InvitePage } from "@/pages/InvitePage";
import { SignInPage } from "@/pages/SignInPage";
import { TemplatesPage } from "@/pages/TemplatesPage";

export function App() {
  return (
    <>
      <ScrollToTop />
      <Seo />
      <Routes>
        <Route path="/invite/:slug" element={<InvitePage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/create/card" element={<CreatePage />} />
          <Route path="/create/:eventType" element={<CreatePage />} />
          <Route path="/builder/:id" element={<BuilderPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
