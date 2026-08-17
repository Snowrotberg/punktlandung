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
  layout?: "default" | "grouped";
};

const links = [
  { href: "/faq", label: "Hilfe" },
  { href: "/infos", label: "Infos" },
  { href: "/feedback", label: "Feedback" },
  { href: "/datenschutz", label: "Datenschutz" }
];

const alignmentClasses = {
  start: "justify-start text-left",
  center: "justify-center text-center",
  end: "justify-end text-right"
};

export function LegalLinks({ className = "", includeInfos = true, align = "start", preserveSession = false, layout = "default" }: LegalLinksProps) {
  const pathname = usePathname();
  const rememberReturn = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (preserveSession && pathname) rememberLegalReturn(pathname);
  };

  const visibleLinks = links.filter((link) => includeInfos || link.href !== "/infos");

  if (layout === "grouped") {
    return (
      <nav
        aria-label="Hilfe und rechtliche Informationen"
        data-layout="grouped"
        className={`min-w-0 text-[11px] font-bold text-slate-500 ${className}`}
      >
        <div data-link-group="support">
          <span data-group-label>Hilfe &amp; Infos</span>
          <div>
            {visibleLinks.filter((link) => link.href !== "/datenschutz").map((link) => (
              <a key={link.href} href={link.href} onClick={rememberReturn}>{link.label}</a>
            ))}
          </div>
        </div>
        <div data-link-group="legal">
          <span data-group-label>Rechtliches</span>
          <div>
            <a href="/datenschutz" onClick={rememberReturn}>Datenschutz</a>
            <CookieSettingsButton className="font-bold text-inherit" />
            <a href="/impressum" onClick={rememberReturn}>Impressum</a>
            <a href="/lizenzen" onClick={rememberReturn}>Lizenzen</a>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Hilfe und rechtliche Informationen"
      className={`punktlandung-legal-links flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-slate-500 ${alignmentClasses[align]} ${className}`}
    >
      <span className="punktlandung-legal-links-support">
        {visibleLinks.filter((link) => link.href !== "/datenschutz").map((link) => (
          <a key={link.href} href={link.href} onClick={rememberReturn} className="transition hover:text-emerald-300 focus-visible:text-emerald-300">
            {link.label}
          </a>
        ))}
      </span>
      <span className="punktlandung-legal-links-rest">
        <a href="/datenschutz" onClick={rememberReturn} className="transition hover:text-emerald-300 focus-visible:text-emerald-300">Datenschutz</a>
        <CookieSettingsButton className="p-0 font-bold text-inherit transition hover:text-emerald-300 focus-visible:text-emerald-300" />
        <a href="/impressum" onClick={rememberReturn} className="transition hover:text-emerald-300 focus-visible:text-emerald-300">Impressum</a>
        <a href="/lizenzen" onClick={rememberReturn} className="transition hover:text-emerald-300 focus-visible:text-emerald-300">Lizenzen</a>
      </span>
    </nav>
  );
}
