import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { Shell } from "@/components/layout/Shell";
import { RequireSupabase } from "@/components/events/ui";
import { AnalyticsListener } from "@/components/seo/AnalyticsListener";
import { Seo } from "@/components/seo/Seo";
import { BuilderPage } from "@/pages/BuilderPage";
import { CreatePage } from "@/pages/CreatePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { InvitePage } from "@/pages/InvitePage";
import { SignInPage } from "@/pages/SignInPage";
import { TemplatesPage } from "@/pages/TemplatesPage";

const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const EventsListPage = named(() => import("@/pages/events/EventsListPage"), "EventsListPage");
const EventWizardPage = named(() => import("@/pages/events/EventWizardPage"), "EventWizardPage");
const EventManagePage = named(() => import("@/pages/events/EventManagePage"), "EventManagePage");
const EventGuestsPage = named(() => import("@/pages/events/EventGuestsPage"), "EventGuestsPage");
const EventPassesPage = named(() => import("@/pages/events/EventPassesPage"), "EventPassesPage");
const EventCheckInPage = named(() => import("@/pages/events/EventCheckInPage"), "EventCheckInPage");
const EventAttendancePage = named(() => import("@/pages/events/EventAttendancePage"), "EventAttendancePage");
const PublicEventPage = named(() => import("@/pages/events/PublicEventPage"), "PublicEventPage");
const GuestPassPage = named(() => import("@/pages/events/GuestPassPage"), "GuestPassPage");

function Lazy({ children }: { children: ReactNode }) {
  return (
    <RequireSupabase>
      <LazyInner>{children}</LazyInner>
    </RequireSupabase>
  );
}

function LazyInner({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
          <div className="h-9 w-9 animate-soft-pulse rounded-full border-2 border-gold/40 border-t-gold" />
          <span className="sr-only">Loading…</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <AnalyticsListener />
      <Seo />
      <Routes>
        <Route path="/invite/:slug" element={<InvitePage />} />
        <Route path="/pass/:token" element={<Lazy><GuestPassPage /></Lazy>} />
        <Route path="/events/:slug" element={<Lazy><PublicEventPage /></Lazy>} />
        <Route element={<Shell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/create/card" element={<CreatePage />} />
          <Route path="/create/:eventType" element={<CreatePage />} />
          <Route path="/builder/:id" element={<BuilderPage />} />
          <Route path="/events" element={<Lazy><EventsListPage /></Lazy>} />
          <Route path="/events/create" element={<Lazy><EventWizardPage /></Lazy>} />
          <Route path="/events/:eventId/edit" element={<Lazy><EventWizardPage /></Lazy>} />
          <Route path="/events/:eventId/manage" element={<Lazy><EventManagePage /></Lazy>} />
          <Route path="/events/:eventId/guests" element={<Lazy><EventGuestsPage /></Lazy>} />
          <Route path="/events/:eventId/passes" element={<Lazy><EventPassesPage /></Lazy>} />
          <Route path="/events/:eventId/check-in" element={<Lazy><EventCheckInPage /></Lazy>} />
          <Route path="/events/:eventId/attendance" element={<Lazy><EventAttendancePage /></Lazy>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
