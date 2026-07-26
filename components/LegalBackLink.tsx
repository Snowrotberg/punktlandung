"use client";

import { useEffect, useState } from "react";
import { BackLink } from "./BackButton";
import { readLegalReturn } from "@/lib/legalNavigation";

export function LegalBackLink() {
  const [href, setHref] = useState("/");

  useEffect(() => {
    setHref(readLegalReturn() ?? "/");
  }, []);

  return (
    <BackLink
      href={href}
      aria-label="Zurück"
      title="Zurück"
      className="punktlandung-back-link normal-case"
    />
  );
}
