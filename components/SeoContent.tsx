import Link from "next/link";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import { faqItems } from "@/lib/seo";

export const seoLinks = [
  { href: "/geoguessr-alternative-deutsch", label: "GeoGuessr Alternative" },
  { href: "/geografie-spiel", label: "Geografie-Spiel" },
  { href: "/orte-erraten-spiel", label: "Orte erraten" },
  { href: "/partyspiel-geografie", label: "Partyspiel" },
  { href: "/kostenloses-geoguessing-spiel", label: "Kostenlos spielen" }
];

const legalLinks = [
  { href: "/infos", label: "Infos" },
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/lizenzen", label: "Lizenzen" }
];

const navigationLinkClass =
  "punktlandung-interactive-surface block w-full rounded-md bg-slate-950/72 px-3 py-1.5 text-left text-sm font-bold text-slate-200 ring-1 ring-slate-700 transition hover:text-emerald-300 hover:ring-emerald-400/60 focus-visible:text-emerald-300 focus-visible:ring-emerald-400/60";

type ImportantPagesProps = {
  className?: string;
};

export function ImportantPages({ className = "" }: ImportantPagesProps) {
  return (
    <aside className={`arcade-panel punktlandung-info-navigation flex flex-col rounded-md border-slate-700/80 bg-slate-900/80 p-4 ${className}`}>
      <h2 className="text-[22px] font-black leading-tight text-white">Wichtige Seiten</h2>
      <nav aria-label="Wichtige Informationsseiten" className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className={navigationLinkClass}>
              {link.label}
            </Link>
          ))}
          <CookieSettingsButton className={navigationLinkClass} />
          <Link href="/faq" className={navigationLinkClass}>
            FAQ
          </Link>
        </div>

        <div aria-hidden="true" className="h-6 shrink-0" />

        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {seoLinks.map((link) => (
            <Link key={link.href} href={link.href} className={navigationLinkClass}>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
}

type FaqCardsProps = {
  limit?: number;
  columns?: boolean;
  headingLevel?: "h2" | "h3";
};

export function FaqCards({ limit, columns = false, headingLevel = "h2" }: FaqCardsProps) {
  const items = typeof limit === "number" ? faqItems.slice(0, limit) : faqItems;
  const Heading = headingLevel;

  return (
    <div className={`grid gap-4 ${columns ? "md:grid-cols-2" : ""}`}>
      {items.map((item) => (
        <article key={item.question} className="rounded-md bg-slate-900/76 p-5 ring-1 ring-slate-700">
          <Heading className="text-[22px] font-black leading-tight text-white">{item.question}</Heading>
          <p className="mt-3 leading-7 text-slate-300">{item.answer}</p>
        </article>
      ))}
    </div>
  );
}

export function HomeSeoContent() {
  return (
    <div>
      <h2 className="text-3xl font-black leading-tight text-white">Kostenloses Geo-Guessing-Spiel auf Deutsch</h2>
      <p className="mt-4 text-base leading-7 text-slate-300">
        Punktlandung ist ein Geografie-Spiel, bei dem du Bilder, Flaggen, Staedte, Landschaften oder Wahrzeichen
        erkennst und den passenden Ort auf der Karte tippst. Je naeher dein Pin am Ziel liegt, desto mehr Punkte
        bekommst du.
      </p>
      <p className="mt-4 text-base leading-7 text-slate-300">
        Du kannst allein spielen oder Punktlandung als Partyspiel am selben Bildschirm nutzen. Damit ist es eine
        deutschsprachige GeoGuessr-Alternative fuer kurze Quizrunden, Spieleabende und Geografie-Fans.
      </p>

      <div className="mt-10">
        <h2 className="text-[22px] font-black leading-tight text-white">Häufige Fragen</h2>
        <div className="mt-4">
          <FaqCards limit={4} columns headingLevel="h3" />
        </div>
      </div>
    </div>
  );
}
