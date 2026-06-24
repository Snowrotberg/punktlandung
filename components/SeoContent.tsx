import Link from "next/link";
import { faqItems } from "@/lib/seo";

const seoLinks = [
  { href: "/geoguessr-alternative-deutsch", label: "GeoGuessr Alternative" },
  { href: "/geografie-spiel", label: "Geografie-Spiel" },
  { href: "/orte-erraten-spiel", label: "Orte erraten" },
  { href: "/partyspiel-geografie", label: "Partyspiel" },
  { href: "/kostenloses-geoguessing-spiel", label: "Kostenlos spielen" },
  { href: "/faq", label: "FAQ" }
];

export function HomeSeoContent() {
  return (
    <section className="bg-slate-950 px-4 py-10 text-slate-100 md:px-6 md:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">Geo-Quiz im Browser</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-white md:text-4xl">
              Kostenloses Geo-Guessing-Spiel auf Deutsch
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Punktlandung ist ein Geografie-Spiel, bei dem du Bilder, Flaggen, Staedte, Landschaften oder Wahrzeichen
              erkennst und den passenden Ort auf der Karte tippst. Je naeher dein Pin am Ziel liegt, desto mehr Punkte
              bekommst du.
            </p>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Du kannst allein spielen oder Punktlandung als Partyspiel am selben Bildschirm nutzen. Damit ist es eine
              deutschsprachige GeoGuessr-Alternative fuer kurze Quizrunden, Spieleabende und Geografie-Fans.
            </p>
          </div>

          <div className="rounded-md bg-slate-900/80 p-5 ring-1 ring-slate-700">
            <h2 className="text-[22px] font-black leading-tight text-white">Wichtige Seiten</h2>
            <nav className="mt-4 grid gap-2">
              {seoLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md bg-slate-950/72 px-3 py-2 font-bold text-slate-200 ring-1 ring-slate-700 transition hover:text-emerald-300 hover:ring-emerald-400/60"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-[22px] font-black leading-tight text-white">Haeufige Fragen</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {faqItems.slice(0, 4).map((item) => (
              <article key={item.question} className="rounded-md bg-slate-900/72 p-4 ring-1 ring-slate-700">
                <h3 className="font-black text-white">{item.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
