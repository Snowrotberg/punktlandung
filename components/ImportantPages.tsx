"use client";

import { usePathname } from "next/navigation";
import { ButtonLink, buttonClassName } from "@/components/Button";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";

const seoLinks = [
  { href: "/so-funktioniert-punktlandung", label: "So funktioniert's" },
  { href: "/ortskatalog", label: "Orte und Aufgaben" },
  { href: "/partyspiel-geografie", label: "Mit Freunden spielen" }
];

const legalLinks = [
  { href: "/faq", label: "Hilfe & Infos" },
  { href: "/feedback", label: "Feedback" },
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/lizenzen", label: "Lizenzen" }
];

const navigationLinkClass =
  "punktlandung-info-navigation-button flex min-h-10 w-full items-center justify-start px-3 py-2 text-left text-sm normal-case tracking-normal";

type ImportantPagesProps = {
  className?: string;
};

function NavigationLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href;

  return (
    <ButtonLink
      href={href}
      tone={active ? "selected" : "ghost"}
      sound="click"
      aria-current={active ? "page" : undefined}
      className={navigationLinkClass}
    >
      {label}
    </ButtonLink>
  );
}

export function ImportantPages({ className = "" }: ImportantPagesProps) {
  const pathname = usePathname() ?? "";

  return (
    <aside className={`arcade-panel punktlandung-info-navigation flex flex-col rounded-md border-slate-700/80 bg-slate-900/80 p-4 ${className}`}>
      <h2 className="text-[22px] font-black leading-tight text-white">Mehr entdecken</h2>
      <nav aria-label="Wichtige Informationsseiten" className="mt-4 flex min-h-0 flex-1 flex-col">
        <p className="punktlandung-info-navigation-label">Service &amp; Rechtliches</p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {legalLinks.map((link) => (
            <NavigationLink key={link.href} {...link} pathname={pathname} />
          ))}
          <CookieSettingsButton className={buttonClassName("ghost", navigationLinkClass)} />
        </div>

        <p className="punktlandung-info-navigation-label mt-5">Rund um Punktlandung</p>

        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {seoLinks.map((link) => (
            <NavigationLink key={link.href} {...link} pathname={pathname} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
