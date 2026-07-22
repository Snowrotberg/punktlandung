"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BackIcon } from "./BackIcon";
import { readLegalReturn } from "@/lib/legalNavigation";

export function LegalBackLink() {
  const [href, setHref] = useState("/");

  useEffect(() => {
    setHref(readLegalReturn() ?? "/");
  }, []);

  return (
    <Link
      href={href}
      aria-label="Zurück"
      title="Zurück"
      className="punktlandung-interactive-control punktlandung-back-link"
    >
      <BackIcon />
    </Link>
  );
}
