export type AnalyticsEventParameters = Record<string, string | number | boolean | undefined>;

export type ReferralAttribution = {
  group: "direct" | "internal" | "chatgpt" | "perplexity" | "claude" | "gemini" | "copilot" | "external";
  hostname?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const analyticsMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
export const analyticsEnabled = /^G-[A-Z0-9]+$/i.test(analyticsMeasurementId);

const aiReferralDomains: Array<{ group: ReferralAttribution["group"]; domains: string[] }> = [
  { group: "chatgpt", domains: ["chatgpt.com", "chat.openai.com"] },
  { group: "perplexity", domains: ["perplexity.ai"] },
  { group: "claude", domains: ["claude.ai"] },
  { group: "gemini", domains: ["gemini.google.com"] },
  { group: "copilot", domains: ["copilot.microsoft.com"] }
];

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function referralAttribution(referrer: string, siteOrigin: string): ReferralAttribution {
  if (!referrer) return { group: "direct" };

  try {
    const referrerUrl = new URL(referrer);
    const siteUrl = new URL(siteOrigin);
    const hostname = referrerUrl.hostname.toLowerCase();

    if (referrerUrl.origin === siteUrl.origin) return { group: "internal", hostname };

    const aiSource = aiReferralDomains.find(({ domains }) =>
      domains.some((domain) => matchesDomain(hostname, domain))
    );

    return {
      group: aiSource?.group ?? "external",
      hostname
    };
  } catch {
    return { group: "external" };
  }
}

export function trackAnalyticsEvent(name: string, parameters: AnalyticsEventParameters = {}): void {
  if (!analyticsEnabled || typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, parameters);
}
