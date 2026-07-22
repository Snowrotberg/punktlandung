"use client";

type GoogleFcApi = {
  callbackQueue?: Array<() => void>;
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

  if (googleFc.showRevocationMessage) {
    googleFc.showRevocationMessage();
    return;
  }

  googleFc.callbackQueue.push(() => googleFc.showRevocationMessage?.());
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
