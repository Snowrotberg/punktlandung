const production = process.env.NODE_ENV === "production";

function contentSecurityPolicy(): string {
  const connectSources = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://commons.wikimedia.org",
    "https://upload.wikimedia.org",
    "https://tiles.openfreemap.org",
    "https://*.google-analytics.com",
    "https://*.googlesyndication.com",
    "https://fundingchoicesmessages.google.com"
  ];
  if (!production) connectSources.push("ws://localhost:*", "ws://127.0.0.1:*", "ws://0.0.0.0:*");

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"} https://*.googletagmanager.com https://*.googlesyndication.com https://fundingchoicesmessages.google.com https://*.google.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://upload.wikimedia.org https://commons.wikimedia.org https://tiles.openfreemap.org https://*.googlesyndication.com https://*.googleusercontent.com",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    "frame-src 'self' https://*.google.com https://*.googlesyndication.com https://fundingchoicesmessages.google.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "report-uri /api/security/csp-report"
  ].join("; ");
}

export function securityHeaders(): Array<[string, string]> {
  const cspMode = process.env.PUNKTLANDUNG_CSP_MODE === "enforce"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
  const headers: Array<[string, string]> = [
    [cspMode, contentSecurityPolicy()],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"]
  ];
  if (production) headers.push(["Strict-Transport-Security", "max-age=15552000"]);
  return headers;
}
