"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "./BackIcon";
import { readLegalReturn } from "@/lib/legalNavigation";

export function LegalBackLink() {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Zurück"
      title="Zurück"
      className="punktlandung-back-link"
      onClick={() => router.push(readLegalReturn() ?? "/")}
    >
      <BackIcon />
    </button>
  );
}
