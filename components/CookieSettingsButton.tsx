"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AD_CONSENT_EVENT, AD_CONSENT_STORAGE_KEY } from "@/lib/ads";

type GoogleFcApi = {
  callbackQueue?: Array<(() => void) | { CONSENT_API_READY: () => void }>;
  showRevocationMessage?: () => void;
};

declare global {
  interface Window {
    googlefc?: GoogleFcApi;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function openPrivacySettings(onOpened: () => void): boolean {
  const googleFc = (window.googlefc ??= {});
  if (typeof googleFc.showRevocationMessage === "function") {
    googleFc.showRevocationMessage();
    onOpened();
    return true;
  }

  googleFc.callbackQueue ??= [];
  googleFc.callbackQueue.push({
    CONSENT_API_READY: () => {
      if (typeof window.googlefc?.showRevocationMessage !== "function") return;
      window.googlefc.showRevocationMessage();
      onOpened();
    }
  });
  return false;
}

type CookieSettingsButtonProps = {
  className?: string;
  children?: string;
};

export function CookieSettingsButton({ className = "", children = "Cookies" }: CookieSettingsButtonProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!fallbackOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFallbackOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fallbackOpen]);

  const denyOptionalStorage = () => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: unknown[]) { window.dataLayer?.push(args); };
    window.gtag("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied"
    });
    try {
      window.localStorage.setItem(AD_CONSENT_STORAGE_KEY, "denied");
    } catch {
      // Consent Mode is still updated for the current page when storage is blocked.
    }
    window.dispatchEvent(new CustomEvent(AD_CONSENT_EVENT, { detail: "denied" }));
    setStatus("Optionale Werbe- und Analyse-Speicherung ist deaktiviert.");
    setFallbackOpen(false);
    fallbackTimerRef.current = window.setTimeout(() => {
      setStatus(null);
      fallbackTimerRef.current = null;
    }, 3500);
  };

  const handleClick = () => {
    if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
    setStatus("Cookie-Einstellungen werden geladen …");

    const opened = openPrivacySettings(() => {
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
      setStatus(null);
    });

    if (opened) return;

    fallbackTimerRef.current = window.setTimeout(() => {
      setStatus(null);
      setFallbackOpen(true);
      fallbackTimerRef.current = null;
    }, 2500);
  };

  return (
    <>
      <button type="button" onClick={handleClick} className={className}>
        {children}
      </button>
      {status && (
        <span
          role="status"
          className="fixed bottom-5 left-1/2 z-[2000] w-[min(92vw,34rem)] -translate-x-1/2 rounded-md border border-slate-500/80 bg-slate-950/95 px-4 py-3 text-center text-sm font-medium normal-case tracking-normal text-slate-100 shadow-2xl"
        >
          {status}
        </span>
      )}
      {fallbackOpen && (
        <div
          className="fixed inset-0 z-[2100] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFallbackOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-fallback-title"
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-6 text-left font-normal text-slate-100 shadow-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Datenschutz</p>
            <h2 id="cookie-fallback-title" className="mt-2 text-xl font-semibold">Cookie-Einstellungen</h2>
            <p className="mt-3 text-sm font-normal leading-6 text-slate-300">
              Die Google-Datenschutzeinstellungen konnten gerade nicht geladen werden. Bis sie verfügbar sind,
              kannst du optionale Werbe- und Analyse-Speicherung sicher deaktivieren oder den Google-Dialog erneut laden.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950"
                onClick={denyOptionalStorage}
              >
                Nur notwendige verwenden
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-100"
                onClick={() => {
                  setFallbackOpen(false);
                  handleClick();
                }}
              >
                Google-Dialog laden
              </button>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-800 pt-4 text-sm">
              <Link href="/datenschutz" className="font-medium text-emerald-300 underline underline-offset-4" onClick={() => setFallbackOpen(false)}>
                Datenschutzerklärung
              </Link>
              <button type="button" className="text-slate-300 underline underline-offset-4" onClick={() => setFallbackOpen(false)}>
                Schließen
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
