/**
 * Google Analytics 4 (gtag) helpers.
 * Enabled only when `VITE_GA_MEASUREMENT_ID` is set (e.g. G-XXXXXXXX).
 */

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function getGaMeasurementId(): string | undefined {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!id || id.includes("XXXX")) return undefined;
  return id;
}

export function isAnalyticsEnabled(): boolean {
  return Boolean(getGaMeasurementId());
}

/** Load gtag once. Safe to call multiple times; no-ops without a measurement ID. */
export function initAnalytics(): void {
  const measurementId = getGaMeasurementId();
  if (!measurementId || initialized || typeof window === "undefined") return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];
  // GA requires the Arguments object, not a rest-parameter array.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false, // HashRouter — we send page_view ourselves
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

export function trackEvent(name: string, params?: AnalyticsParams): void {
  const measurementId = getGaMeasurementId();
  if (!measurementId || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, {
    ...params,
    send_to: measurementId,
  });
}

/** SPA page view for HashRouter paths. */
export function trackPageView(path: string, title?: string): void {
  const measurementId = getGaMeasurementId();
  if (!measurementId || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title ?? document.title,
    page_location: window.location.href,
    send_to: measurementId,
  });
}

export function trackTemplateClick(opts: {
  templateId: string;
  templateName: string;
  kind: "invitation" | "card";
  source: "home" | "gallery" | "create";
  eventType?: string;
  cardType?: string;
}): void {
  trackEvent("template_click", {
    template_id: opts.templateId,
    template_name: opts.templateName,
    template_kind: opts.kind,
    source: opts.source,
    event_type: opts.eventType,
    card_type: opts.cardType,
  });
}

export function trackTemplateUse(opts: {
  templateId: string;
  templateName: string;
  kind: "invitation" | "card";
  eventType?: string;
  cardType?: string;
}): void {
  trackEvent("template_use", {
    template_id: opts.templateId,
    template_name: opts.templateName,
    template_kind: opts.kind,
    event_type: opts.eventType,
    card_type: opts.cardType,
  });
}

export function trackPreview(opts: {
  templateId: string;
  templateName: string;
  source: "builder" | "invite";
  kind?: "invitation" | "card";
}): void {
  trackEvent("preview_open", {
    template_id: opts.templateId,
    template_name: opts.templateName,
    template_kind: opts.kind,
    source: opts.source,
  });
}

export function trackDownload(opts: {
  templateId: string;
  templateName: string;
  format: "png" | "pdf";
  source: "builder" | "dashboard";
  kind?: "invitation" | "card";
}): void {
  trackEvent("download", {
    template_id: opts.templateId,
    template_name: opts.templateName,
    template_kind: opts.kind,
    format: opts.format,
    source: opts.source,
  });
}
