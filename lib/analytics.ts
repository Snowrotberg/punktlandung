export type AnalyticsEventParameters = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const analyticsMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
export const analyticsEnabled = /^G-[A-Z0-9]+$/i.test(analyticsMeasurementId);

export function trackAnalyticsEvent(name: string, parameters: AnalyticsEventParameters = {}): void {
  if (!analyticsEnabled || typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, parameters);
}
