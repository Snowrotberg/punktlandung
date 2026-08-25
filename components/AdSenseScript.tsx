"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isEditorialAdRoute } from "@/lib/adRoutePolicy";

export function AdSenseScript({ clientId }: { clientId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const existingScript = document.getElementById("punktlandung-adsense");
    if (!clientId || !isEditorialAdRoute(pathname)) {
      existingScript?.remove();
      return;
    }
    if (existingScript) return;

    const script = document.createElement("script");
    script.id = "punktlandung-adsense";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    document.head.appendChild(script);
  }, [clientId, pathname]);

  return null;
}
