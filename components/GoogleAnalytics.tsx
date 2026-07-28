"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { analyticsEnabled, analyticsMeasurementId, referralAttribution, trackAnalyticsEvent } from "@/lib/analytics";

export function GoogleAnalytics() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!analyticsEnabled || !pathname || previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    const entryReferral = referralAttribution(document.referrer, window.location.origin);
    trackAnalyticsEvent("page_view", {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
      entry_referral_group: entryReferral.group,
      entry_referral_host: entryReferral.hostname
    });
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
