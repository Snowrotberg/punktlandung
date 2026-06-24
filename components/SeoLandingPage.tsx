import Link from "next/link";

type SeoLandingPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
};

const relatedLinks = [
  { href: "/geoguessr-alternative-deutsch", label: "GeoGuessr Alternative Deutsch" },
  { href: "/geografie-spiel", label: "Geografie-Spiel" },
  { href: "/orte-erraten-spiel", label: "Orte erraten Spiel" },
  { href: "/partyspiel-geografie", label: "Geografie-Partyspiel" },
  { href: "/kostenloses-geoguessing-spiel", label: "Kostenloses GeoGuessing-Spiel" },
  { href: "/faq", label: "FAQ" }
];

export function SeoLandingPage({ eyebrow, title, intro, sections }: SeoLandingPageProps) {
  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <section className="border-b border-slate-800 px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300 hover:text-emerald-200">
            Punktlandung spielen
          </Link>
          <p className="mt-8 text-sm font-black uppercase tracking-[0.18em] text-indigo-300">{eyebrow}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{intro}</p>
          <Link
            href="/"
            className="mt-7 inline-flex rounded-md bg-emerald-400 px-5 py-3 font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-300"
          >
            Jetzt kostenlos starten
          </Link>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <article key={section.title} className="rounded-md bg-slate-900/76 p-5 ring-1 ring-slate-700">
              <h2 className="text-[22px] font-black leading-tight text-white">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-10 md:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-black leading-tight text-white">Weitere Geo-Quiz-Seiten</h2>
          <nav className="mt-4 flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-bold text-slate-200 ring-1 ring-slate-700 transition hover:text-emerald-300 hover:ring-emerald-400/60"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
