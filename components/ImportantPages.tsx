"use client";

import { usePathname } from "next/navigation";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";

const seoLinks = [
  { href: "/so-funktioniert-punktlandung", label: "So funktioniert's" },
  { href: "/ortskatalog", label: "Orte und Aufgaben" },
  { href: "/geoguessr-alternative-deutsch", label: "GeoGuessr Alternative" },
  { href: "/geografie-spiel", label: "Geografie-Spiel" },
  { href: "/orte-erraten-spiel", label: "Orte erraten" },
  { href: "/partyspiel-geografie", label: "Partyspiel" },
  { href: "/kostenloses-geoguessing-spiel", label: "Kostenlos spielen" }
];

const legalLinks = [
  { href: "/infos", label: "Infos" },
  { href: "/feedback", label: "Feedback" },
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/lizenzen", label: "Lizenzen" }
];

const navigationLinkClass =
  "punktlandung-interactive-surface relative block w-full overflow-hidden rounded-md border px-3 py-1.5 text-left text-sm font-bold transition";
const inactiveLinkClass =
  "border-slate-700 bg-slate-950/72 text-slate-200 hover:border-emerald-400/60 hover:text-emerald-300 focus-visible:border-emerald-300/80 focus-visible:text-emerald-300";
const activeLinkClass =
  "border-emerald-300/75 bg-emerald-400/12 pl-4 text-emerald-100 shadow-[inset_0_0_18px_rgba(52,211,153,0.10)] before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-r-full before:bg-emerald-300";

type ImportantPagesProps = {
  className?: string;
};

function NavigationLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href;

  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${navigationLinkClass} ${active ? activeLinkClass : inactiveLinkClass}`}
    >
      {label}
    </a>
  );
}

export function ImportantPages({ className = "" }: ImportantPagesProps) {
  const pathname = usePathname() ?? "";

  return (
    <aside className={`arcade-panel punktlandung-info-navigation flex flex-col rounded-md border-slate-700/80 bg-slate-900/80 p-4 ${className}`}>
      <h2 className="text-[22px] font-black leading-tight text-white">Wichtige Seiten</h2>
      <nav aria-label="Wichtige Informationsseiten" className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {legalLinks.map((link) => (
            <NavigationLink key={link.href} {...link} pathname={pathname} />
          ))}
          <CookieSettingsButton className={`${navigationLinkClass} ${inactiveLinkClass}`} />
          <NavigationLink href="/faq" label="FAQ" pathname={pathname} />
        </div>

        <div aria-hidden="true" className="h-6 shrink-0" />

        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {seoLinks.map((link) => (
            <NavigationLink key={link.href} {...link} pathname={pathname} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
