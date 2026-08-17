import { resolve4 } from "node:dns/promises";
import tls from "node:tls";
import { isIP } from "node:net";

const base = new URL(process.env.SECURITY_MONITOR_URL || "https://punktlandung.app");
const routes = [
  ["/", ["Punktlandung", "Direkt spielen"]],
  ["/anmelden", ["Punktlandung", "Sicher anmelden"]],
  ["/infos", ["Was ist Punktlandung?"]]
];
const allowedResourceHosts = new Set([
  base.hostname,
  "www.googletagmanager.com",
  "pagead2.googlesyndication.com",
  "fundingchoicesmessages.google.com"
]);
const failures = [];

for (const [route, expectedTexts] of routes) {
  const response = await fetch(new URL(route, base), { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  const body = await response.text();
  if (!response.ok) failures.push(`${route}: HTTP ${response.status}`);
  if (response.url !== new URL(route, base).toString()) failures.push(`${route}: unexpected final URL ${response.url}`);
  for (const text of expectedTexts) if (!body.includes(text)) failures.push(`${route}: expected text missing: ${text}`);
  for (const header of ["x-content-type-options", "referrer-policy", "permissions-policy"]) {
    if (!response.headers.get(header)) failures.push(`${route}: missing ${header}`);
  }
  if (!response.headers.get("content-security-policy") && !response.headers.get("content-security-policy-report-only")) failures.push(`${route}: missing CSP`);
  for (const match of body.matchAll(/<script[^>]+src=["']([^"']+)/gi)) {
    const scriptUrl = new URL(match[1], response.url);
    if (!allowedResourceHosts.has(scriptUrl.hostname)) failures.push(`${route}: unexpected script host ${scriptUrl.hostname}`);
  }
  for (const match of body.matchAll(/<form[^>]+action=["']([^"']+)/gi)) {
    if (new URL(match[1], response.url).origin !== base.origin) failures.push(`${route}: external form action ${match[1]}`);
  }
}

if (!isIP(base.hostname)) {
  try { if (!(await resolve4(base.hostname)).length) failures.push("canonical DNS has no A record"); } catch (error) { failures.push(`DNS check failed: ${error.message}`); }
}
if (base.protocol === "https:") {
  await new Promise((resolve) => {
    const socket = tls.connect(Number(base.port || 443), base.hostname, { servername: base.hostname, timeout: 15_000 }, () => {
      const certificate = socket.getPeerCertificate();
      if (!certificate.valid_to || Date.parse(certificate.valid_to) - Date.now() < 14 * 86_400_000) failures.push("TLS certificate expires in less than 14 days");
      socket.end(); resolve();
    });
    socket.on("error", (error) => { failures.push(`TLS check failed: ${error.message}`); resolve(); });
    socket.on("timeout", () => { failures.push("TLS check timed out"); socket.destroy(); resolve(); });
  });
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Security monitor passed for ${base.origin} (${routes.length} pages).`);
