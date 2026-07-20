"use client";

import { useEffect, useRef } from "react";
import { adConfig, type AdPlacement, type AdVariant, isAdPlacementConfigured } from "@/lib/ads";

type AdContainerProps = {
  placement?: AdPlacement;
  variant?: AdVariant;
  adFormat?: "auto" | "horizontal" | "vertical";
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

function variantShape(variant: AdVariant) {
  if (variant === "rail") return "min-h-[420px] w-full";
  if (variant === "game") {
    return "h-[11rem] w-[min(92vw,240px)] sm:h-[11rem] sm:w-[min(92vw,240px)] min-[1900px]:h-[11.5rem] min-[1900px]:w-[min(92vw,260px)]";
  }
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
  const requestedRef = useRef(false);
  const adElementRef = useRef<HTMLModElement | null>(null);
  const slotId = adConfig.slots[placement];
  const placementConfigured = isAdPlacementConfigured(placement);
  const shape = variantShape(variant);
  const positionClass = position === "absolute" ? "absolute" : "relative";
  const defaultFormat = adFormat ?? variantFormat(variant);

  useEffect(() => {
    const adElement = adElementRef.current;
    if (!placementConfigured || !adElement || requestedRef.current) return;

    let timeout: number | undefined;
    let didPush = false;
    const isSettingsBlock = placement === "solo-settings-banner" || placement === "party-settings-banner";
    const guardedAncestors: HTMLElement[] = [];
    let ancestor = adElement.parentElement;

    if (isSettingsBlock) {
      while (ancestor && ancestor !== document.body) {
        guardedAncestors.push(ancestor);
        if (ancestor.matches("main.punktlandung-lobby")) break;
        ancestor = ancestor.parentElement;
      }
    }

    const clearInjectedAutoHeights = () => {
      guardedAncestors.forEach((element) => {
        if (element.style.getPropertyValue("height") === "auto" && element.style.getPropertyPriority("height") === "important") {
          element.style.removeProperty("height");
        }
      });
    };

    const layoutObserver = new MutationObserver(clearInjectedAutoHeights);
    const layoutRoot = guardedAncestors.at(-1);
    if (layoutRoot) {
      layoutObserver.observe(layoutRoot, { attributes: true, attributeFilter: ["style"], subtree: true });
    }
    const requestAd = () => {
      if (requestedRef.current) return;

      const bounds = adElement.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const useCompactSoloBanner =
        placement === "solo-settings-banner" &&
        window.matchMedia("(min-width: 1024px) and (max-width: 1899px) and (orientation: landscape)").matches;
      adElement.dataset.adFormat = useCompactSoloBanner ? "horizontal" : defaultFormat;

      requestedRef.current = true;
      timeout = window.setTimeout(() => {
        try {
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.push({});
          didPush = true;
        } catch {
          requestedRef.current = false;
        }
      }, 80);
    };

    requestAd();
    const resizeObserver = new ResizeObserver(requestAd);
    resizeObserver.observe(adElement);

    return () => {
      resizeObserver.disconnect();
      layoutObserver.disconnect();
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        if (!didPush) requestedRef.current = false;
      }
    };
  }, [defaultFormat, placement, placementConfigured]);

  return (
    <aside
      aria-label={label}
      className={`arcade-panel ${positionClass} overflow-hidden rounded-md border-indigo-500/55 bg-slate-900/82 ${shape} ${className}`}
    >
      {placementConfigured ? (
        <ins
          ref={adElementRef}
          className="adsbygoogle block h-full w-full"
          style={{ display: "block" }}
          data-ad-client={adConfig.clientId}
          data-ad-format={defaultFormat}
          data-ad-slot={slotId}
          data-adtest={adConfig.testMode ? "on" : undefined}
          data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-4 text-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">{label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">AdSense-ready Fläche.</p>
          </div>
        </div>
      )}
    </aside>
  );
}
