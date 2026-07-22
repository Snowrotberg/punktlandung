"use client";

import Link from "next/link";
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
  const rememberReturn = () => {
    if (preserveSession && pathname) rememberLegalReturn(pathname);
  };

  return (
    <nav
      aria-label="Rechtliche Informationen"
      className={`flex min-w-0 flex-nowrap items-center gap-x-2 whitespace-nowrap text-[11px] font-bold text-slate-500 ${alignmentClasses[align]} ${className}`}
    >
      {includeInfos && (
        <Link href="/infos" onClick={rememberReturn} className="transition hover:text-emerald-300 focus-visible:text-emerald-300">
          Infos
        </Link>
      )}
      {links.map((link) => (
        <Link key={link.href} href={link.href} onClick={rememberReturn} className="transition hover:text-emerald-300 focus-visible:text-emerald-300">
          {link.label}
        </Link>
      ))}
      <CookieSettingsButton className="p-0 font-bold text-inherit transition hover:text-emerald-300 focus-visible:text-emerald-300" />
    </nav>
  );
}
