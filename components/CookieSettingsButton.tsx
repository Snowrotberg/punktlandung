"use client";

import { useEffect, useRef, useState } from "react";

type GoogleFcApi = {
  callbackQueue?: Array<(() => void) | { CONSENT_API_READY: () => void }>;
  showRevocationMessage?: () => void;
};

declare global {
  interface Window {
    googlefc?: GoogleFcApi;
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
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
    };
  }, []);

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
      setStatus("Die Cookie-Einstellungen konnten nicht geladen werden. Bitte Tracking-Schutz kurz deaktivieren und erneut versuchen.");
      fallbackTimerRef.current = null;
    }, 3000);
  };

  return (
    <>
      <button type="button" onClick={handleClick} className={className}>
        {children}
      </button>
      {status && (
        <span
          role="status"
          className="fixed bottom-5 left-1/2 z-[2000] w-[min(92vw,34rem)] -translate-x-1/2 rounded-md border border-slate-500/80 bg-slate-950/95 px-4 py-3 text-center text-sm font-bold normal-case tracking-normal text-slate-100 shadow-2xl"
        >
          {status}
        </span>
      )}
    </>
  );
}
