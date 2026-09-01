export type AdminPageStat = { views: number; durationMs: number };

export function isInternalAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export function selectAdminTopPages(
  pageStats: ReadonlyMap<string, AdminPageStat>,
  limit = 5
): Array<[string, AdminPageStat]> {
  return [...pageStats]
    .filter(([path]) => !isInternalAdminPath(path))
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, limit);
}
