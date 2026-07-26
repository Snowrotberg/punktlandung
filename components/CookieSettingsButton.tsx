"use client";

type GoogleFcApi = {
  callbackQueue?: Array<(() => void) | { CONSENT_API_READY: () => void }>;
  showRevocationMessage?: () => void;
};

declare global {
  interface Window {
    googlefc?: GoogleFcApi;
  }
}

function openPrivacySettings() {
  const googleFc = (window.googlefc ??= {});
  googleFc.callbackQueue ??= [];
  googleFc.callbackQueue.push({
    CONSENT_API_READY: () => window.googlefc?.showRevocationMessage?.()
  });
}

type CookieSettingsButtonProps = {
  className?: string;
  children?: string;
};

export function CookieSettingsButton({ className = "", children = "Cookies" }: CookieSettingsButtonProps) {
  return (
    <button type="button" onClick={openPrivacySettings} className={className}>
      {children}
    </button>
  );
}
