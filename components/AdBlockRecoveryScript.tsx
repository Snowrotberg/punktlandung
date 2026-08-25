"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isEditorialAdRoute } from "@/lib/adRoutePolicy";

/** Loads only the official tag copied from AdSense Privacy & messaging. */
export function AdBlockRecoveryScript({ enabled, tagUrl }: { enabled: boolean; tagUrl: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const existingScript = document.getElementById("punktlandung-adblock-recovery");
    if (!enabled || !tagUrl || !isEditorialAdRoute(pathname)) {
      existingScript?.remove();
      return;
    }
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
