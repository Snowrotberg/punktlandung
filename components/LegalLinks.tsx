"use client";

import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import { rememberLegalReturn } from "@/lib/legalNavigation";

type LegalLinksProps = {
  className?: string;
  includeInfos?: boolean;
  align?: "start" | "center" | "end";
  preserveSession?: boolean;
};

const links = [
  { href: "/feedback", label: "Feedback" },
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/lizenzen", label: "Lizenzen" }
];

const alignmentClasses = {
  start: "justify-start text-left",
  center: "justify-center text-center",
  end: "justify-end text-right"
};

export function LegalLinks({ className = "", includeInfos = true, align = "start", preserveSession = false }: LegalLinksProps) {
  const pathname = usePathname();
  const rememberReturn = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (preserveSession && pathname) rememberLegalReturn(pathname);
  };

  return (
    <nav
      aria-label="Rechtliche Informationen"
      className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-slate-500 ${alignmentClasses[align]} ${className}`}
    >
      {includeInfos && (
        <a href="/infos" onClick={rememberReturn} className="transition hover:text-emerald-300 focus-visible:text-emerald-300">
          Infos
        </a>
      )}
      {links.map((link) => (
        <a key={link.href} href={link.href} onClick={rememberReturn} className="transition hover:text-emerald-300 focus-visible:text-emerald-300">
          {link.label}
        </a>
      ))}
      <CookieSettingsButton className="p-0 font-bold text-inherit transition hover:text-emerald-300 focus-visible:text-emerald-300" />
    </nav>
  );
}
