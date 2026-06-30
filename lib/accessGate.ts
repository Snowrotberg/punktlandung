export const ACCESS_COOKIE_NAME = "punktlandung_access_v1";
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const PUBLIC_PATHS = new Set(["/zugang", "/impressum", "/datenschutz"]);

const PUBLIC_PREFIXES = [
  "/api/access",
  "/_next",
  "/favicon.ico",
  "/icon.png",
  "/robots.txt",
  "/sitemap.xml"
];

const PUBLIC_FILE_PATTERN =
  /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|woff|woff2)$/i;

export function hasAccessPassword() {
  return getAccessPasswords().length > 0;
}

export function getAccessPasswords() {
  return [
    process.env.APP_ACCESS_PASSWORD?.trim(),
    process.env.APP_TEST_ACCESS_PASSWORD?.trim()
  ].filter((password): password is string => Boolean(password));
}

export function isAccessPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ||
    PUBLIC_FILE_PATTERN.test(pathname)
  );
}

export function safeNextPath(value: unknown) {
  const next = typeof value === "string" ? value : "";

  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    next.startsWith("/zugang") ||
    next.startsWith("/api/access")
  ) {
    return "/";
  }

  return next;
}
