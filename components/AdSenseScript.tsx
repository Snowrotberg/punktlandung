"use client";

import { useEffect } from "react";

export function AdSenseScript({ clientId }: { clientId: string }) {
  useEffect(() => {
    if (!clientId || document.getElementById("punktlandung-adsense")) return;
    const script = document.createElement("script");
    script.id = "punktlandung-adsense";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    document.head.appendChild(script);
  }, [clientId]);

  return null;
}
