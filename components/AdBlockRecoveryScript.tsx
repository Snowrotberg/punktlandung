"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const excludedPrefixes = [
  "/spielen",
  "/aufloesung",
  "/endergebnis",
  "/anmelden",
  "/registrieren",
  "/datenschutz",
  "/impressum",
  "/cookies"
];

/** Loads only the official tag copied from AdSense Privacy & messaging. */
export function AdBlockRecoveryScript({ enabled, tagUrl }: { enabled: boolean; tagUrl: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled || !tagUrl || !pathname || excludedPrefixes.some((prefix) => pathname.startsWith(prefix))) return;
    if (document.getElementById("punktlandung-adblock-recovery")) return;
    let parsed: URL;
    try {
      parsed = new URL(tagUrl);
    } catch {
      return;
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== "fundingchoicesmessages.google.com") return;

    const script = document.createElement("script");
    script.id = "punktlandung-adblock-recovery";
    script.async = true;
    script.src = parsed.toString();
    document.head.appendChild(script);
    return () => script.remove();
  }, [enabled, pathname, tagUrl]);

  return null;
}
