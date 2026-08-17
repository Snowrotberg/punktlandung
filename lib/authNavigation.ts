export const authCallbackPath = "/auth/callback";
export const defaultAuthReturnPath = "/";

const localAuthOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
const productionAuthOrigins = new Set(["https://punktlandung.app", "https://www.punktlandung.app"]);

/** Uses the current browser origin only for known app hosts and local development. */
export function safeAuthOrigin(candidate: string | null | undefined, fallback: string): string {
  const fallbackOrigin = new URL(fallback).origin;
  if (!candidate) return fallbackOrigin;
  try {
    const origin = new URL(candidate).origin;
    return localAuthOrigins.has(origin) || productionAuthOrigins.has(origin) ? origin : fallbackOrigin;
  } catch {
    return fallbackOrigin;
  }
}

/** Prevents OAuth callbacks from becoming an open redirect. */
export function safeAuthReturnPath(value: string | null | undefined): string {
  if (!value) return defaultAuthReturnPath;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value).trim();
  } catch {
    return defaultAuthReturnPath;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || /[\u0000-\u001f]/.test(decoded)) {
    return defaultAuthReturnPath;
  }
  try {
    const parsed = new URL(decoded, "https://punktlandung.invalid");
    if (parsed.origin !== "https://punktlandung.invalid") return defaultAuthReturnPath;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultAuthReturnPath;
  }
}

export function webAuthCallbackUrl(origin: string, returnTo?: string | null): string {
  const callback = new URL(authCallbackPath, origin);
  callback.searchParams.set("returnTo", safeAuthReturnPath(returnTo));
  return callback.toString();
}
