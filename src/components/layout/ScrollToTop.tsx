import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scroll to top on every route change so create/home land at the start of the page. */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search, hash]);

  return null;
}
