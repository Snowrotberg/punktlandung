"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { analyticsEnabled, analyticsMeasurementId, referralAttribution, trackAnalyticsEvent } from "@/lib/analytics";

function normalizedPath(pathname: string): string {
  if (/^\/konto\/verlauf\/[^/]+$/.test(pathname)) return "/konto/verlauf/[spiel]";
  return pathname.toLowerCase().replace(/\/{2,}/g, "/").slice(0, 100) || "/";
}

function viewportContext() {
  const width = window.innerWidth;
  const deviceClass = width < 600 ? "phone" : width < 1024 ? "tablet" : width < 1440 ? "laptop" : width < 1920 ? "desktop" : "large-screen";
  const viewportBucket = width < 360 ? "unter 360" : width < 480 ? "360–479" : width < 768 ? "480–767" : width < 1024 ? "768–1023" : width < 1440 ? "1024–1439" : width < 1920 ? "1440–1919" : "1920+";
  return { deviceClass, viewportBucket };
}

function visitId(): string {
  const key = "punktlandung-operational-visit-id-v2";
  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored) return stored;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function recordOperationalEvent(event: "page_view" | "page_engagement" | "visit_start", path: string, id: string, durationMs?: number) {
  void fetch("/api/usage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, path, visitId: id, ...viewportContext(), ...(durationMs ? { durationMs } : {}) }),
    keepalive: true
  }).catch(() => undefined);
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    const path = normalizedPath(pathname);
    const id = visitId();
    try {
      const visitKey = "punktlandung-operational-visit-v2";
      if (!window.sessionStorage.getItem(visitKey)) {
        window.sessionStorage.setItem(visitKey, "1");
        recordOperationalEvent("visit_start", path, id);
      }
    } catch {
      // A page view remains useful even when session storage is unavailable.
    }
    recordOperationalEvent("page_view", path, id);
    let visibleSince = document.visibilityState === "visible" ? performance.now() : null;
    let activeMs = 0;
    let sent = false;
    const pause = () => {
      if (visibleSince !== null) activeMs += performance.now() - visibleSince;
      visibleSince = null;
    };
    const resume = () => { if (visibleSince === null) visibleSince = performance.now(); };
    const flush = () => {
      if (sent) return;
      pause();
      sent = true;
      const durationMs = Math.min(30 * 60_000, Math.round(activeMs));
      if (durationMs >= 1_000) recordOperationalEvent("page_engagement", path, id, durationMs);
    };
    const onVisibilityChange = () => document.visibilityState === "visible" ? resume() : pause();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    if (analyticsEnabled) {
      const entryReferral = referralAttribution(document.referrer, window.location.origin);
      trackAnalyticsEvent("page_view", {
        page_path: pathname,
        page_location: `${window.location.origin}${pathname}`,
        page_title: document.title,
        entry_referral_group: entryReferral.group,
        entry_referral_host: entryReferral.hostname
      });
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [pathname]);

  if (!analyticsEnabled) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsMeasurementId)}`} strategy="afterInteractive" />
      <Script id="punktlandung-ga4-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());window.gtag('config','${analyticsMeasurementId}',{send_page_view:false});`}
      </Script>
    </>
  );
}
