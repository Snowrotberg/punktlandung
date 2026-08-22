function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof Request) return new URL(input.url);
    return new URL(String(input));
  } catch {
    return null;
  }
}

/**
 * New `sb_secret_` keys authenticate PostgREST through `apikey`. Some hosted
 * gateways reject the SDK's unauthenticated fallback `Authorization: Bearer
 * sb_secret_...` as a malformed JWT (PGRST303). Strip only that duplicate
 * header for the trusted Data API; Auth keeps the SDK's normal headers.
 */
export function createSupabaseSecretKeyFetch(
  secretKey: string,
  baseFetch: typeof fetch = fetch
): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    const url = requestUrl(input);
    const duplicateSecretBearer = headers.get("authorization") === `Bearer ${secretKey}`;

    if (secretKey.startsWith("sb_secret_") && url?.pathname.startsWith("/rest/v1/") && duplicateSecretBearer) {
      headers.delete("authorization");
    }

    return baseFetch(input, { ...init, headers });
  };
}
