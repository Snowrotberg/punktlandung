"use client";

import { useEffect, useRef, useState } from "react";
import {
  AD_CONSENT_EVENT,
  AD_CONSENT_STORAGE_KEY,
  adConfig,
  type AdPlacement,
  type AdVariant,
  isAdPlacementConsentRequired,
  isAdPlacementConfigured
} from "@/lib/ads";

type AdContainerProps = {
  placement?: AdPlacement;
  variant?: AdVariant;
  adFormat?: "auto" | "vertical";
  label?: string;
  className?: string;
  position?: "relative" | "absolute";
  fullWidthResponsive?: boolean;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function hasAdConsent(placement: AdPlacement) {
  if (!isAdPlacementConsentRequired(placement)) return true;
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AD_CONSENT_STORAGE_KEY) === "accepted";
}

function variantShape(variant: AdVariant) {
  if (variant === "rail") return "min-h-[420px] w-full";
  if (variant === "game") return "h-[11rem] w-[min(92vw,240px)] sm:h-[11rem] sm:w-[min(92vw,240px)] min-[1900px]:h-[11.5rem] min-[1900px]:w-[min(92vw,260px)]";
  return "min-h-[96px] w-full";
}

function variantFormat(variant: AdVariant) {
  if (variant === "rail") return "vertical";
  return "auto";
}

export function AdContainer({
  placement = "home-left-rail",
  variant = "banner",
  adFormat,
  label = "Anzeige",
  className = "",
  position = "relative",
  fullWidthResponsive = true
}: AdContainerProps) {
  const [consentGranted, setConsentGranted] = useState(false);
  const requestedRef = useRef(false);
  const slotId = adConfig.slots[placement];
  const placementConfigured = isAdPlacementConfigured(placement);
  const consentRequired = isAdPlacementConsentRequired(placement);
  const canRequestAd = placementConfigured && consentGranted;
  const shape = variantShape(variant);
  const positionClass = position === "absolute" ? "absolute" : "relative";

  useEffect(() => {
    const syncConsent = () => setConsentGranted(hasAdConsent(placement));
    syncConsent();
    window.addEventListener(AD_CONSENT_EVENT, syncConsent);
    window.addEventListener("storage", syncConsent);
    return () => {
      window.removeEventListener(AD_CONSENT_EVENT, syncConsent);
      window.removeEventListener("storage", syncConsent);
    };
  }, [placement]);

  useEffect(() => {
    if (!canRequestAd || requestedRef.current) return;
    requestedRef.current = true;

    const timeout = window.setTimeout(() => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch {
        requestedRef.current = false;
      }
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [canRequestAd]);

  const allowAds = () => {
    window.localStorage.setItem(AD_CONSENT_STORAGE_KEY, "accepted");
    window.dispatchEvent(new Event(AD_CONSENT_EVENT));
  };

  return (
    <aside
      aria-label={label}
      className={`arcade-panel ${positionClass} overflow-hidden rounded-md border-indigo-500/55 bg-slate-900/82 ${shape} ${className}`}
    >
      {canRequestAd && (
        <ins
          className="adsbygoogle block h-full w-full"
          style={{ display: "block" }}
          data-ad-client={adConfig.clientId}
          data-ad-format={adFormat ?? variantFormat(variant)}
          data-ad-slot={slotId}
          data-adtest={adConfig.testMode ? "on" : undefined}
          data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
        />
      )}

      {!canRequestAd && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">{label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {placementConfigured ? "Wird erst nach Zustimmung geladen." : "AdSense-ready Fläche."}
            </p>
            {placementConfigured && consentRequired && (
              <button
                type="button"
                onClick={allowAds}
                className="mt-3 rounded-md bg-slate-950/70 px-3 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-300/50 transition hover:bg-emerald-400/10"
              >
                Anzeigen erlauben
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
