function requestCookieEntries(request: Request): Array<{ name: string; value: string }> {
  return (request.headers.get("cookie") ?? "").split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return [];
    return [{ name: part.slice(0, separator).trim(), value: part.slice(separator + 1).trim() }];
  });
}

export function supabaseAuthCookieName(supabaseUrl: string): string | null {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".", 1)[0]?.trim();
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

export function hasSupabaseAuthCookie(request: Request, supabaseUrl: string): boolean {
  const cookieName = supabaseAuthCookieName(supabaseUrl);
  if (!cookieName) return false;
  return requestCookieEntries(request).some(({ name, value }) =>
    Boolean(value) && (name === cookieName || name.startsWith(`${cookieName}.`))
  );
}
