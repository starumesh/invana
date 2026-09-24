import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

/** Sends GA4 page_view on HashRouter navigation. */
export function AnalyticsListener() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    const path = `${pathname}${search}${hash}` || "/";
    trackPageView(path);
  }, [pathname, search, hash]);

  return null;
}
