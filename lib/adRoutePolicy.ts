const editorialAdRoutes = [
  "/infos",
  "/so-funktioniert-punktlandung",
  "/ortskatalog",
  "/partyspiel-geografie",
  "/faq"
] as const;

function normalizePathname(pathname: string | null | undefined) {
  if (!pathname) return "/";
  const withoutQueryOrHash = pathname.split(/[?#]/, 1)[0] || "/";
  if (withoutQueryOrHash === "/") return "/";
  return withoutQueryOrHash.replace(/\/+$/, "");
}

/**
 * AdSense is deliberately limited to substantial editorial pages. Functional
 * routes such as gameplay, setup, results, account, rankings and community do
 * not qualify even when an AdContainer happens to remain in their layout.
 */
export function isEditorialAdRoute(pathname: string | null | undefined) {
  const normalizedPathname = normalizePathname(pathname);
  return editorialAdRoutes.some(
    (route) => normalizedPathname === route || normalizedPathname.startsWith(`${route}/`)
  );
}

export const adRoutePolicy = {
  editorialRoutes: editorialAdRoutes
} as const;
