import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import { InfoPageShell } from "@/components/InfoPageShell";
import { JsonLd } from "@/components/StructuredData";
import { builtInLocations } from "@/data/locations";
import { absoluteUrl } from "@/lib/seo";
import type { LocationCategory } from "@/types/game";

export const metadata: Metadata = {
  title: "Welche Orte und Aufgaben gibt es bei Punktlandung?",
  description:
    "Welche Inhalte bietet Punktlandung? Übersicht über spielbare Orte, Flaggen, Kategorien, Länderabdeckung, Bildauswahl und Quellen.",
  alternates: {
    canonical: absoluteUrl("/ortskatalog")
  }
};

type CatalogCategory = Exclude<LocationCategory, "mixed" | "streetview">;

const categoryLabels: Record<CatalogCategory, string> = {
  cities: "Städte",
  capitals: "Hauptstädte",
  landmarks: "Wahrzeichen",
  landscapes: "Landschaften",
  flags: "Flaggen"
};

const categoryOrder: CatalogCategory[] = [
  "cities",
  "capitals",
  "landmarks",
  "landscapes",
  "flags"
];

const categoryCounts = builtInLocations.reduce<Record<string, number>>((counts, location) => {
  counts[location.category] = (counts[location.category] ?? 0) + 1;
  return counts;
}, {});

const countryCount = new Set(builtInLocations.map((location) => location.countryCode).filter(Boolean)).size;

const catalogStructuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": `${absoluteUrl("/ortskatalog")}#collection`,
  name: "Punktlandung-Ortskatalog",
  url: absoluteUrl("/ortskatalog"),
  description: `Übersicht über ${builtInLocations.length.toLocaleString("de-DE")} spielbare Orts- und Flaggenaufgaben in fünf Kategorien.`,
  inLanguage: "de-DE",
  dateModified: "2026-07-28",
  isPartOf: {
    "@id": `${absoluteUrl("/")}#website`
  },
  about: categoryOrder.map((category) => ({
    "@type": "Thing",
    name: categoryLabels[category]
  })),
  mainEntity: {
    "@type": "ItemList",
    name: "Spielbare Kategorien bei Punktlandung",
    numberOfItems: categoryOrder.length,
    itemListElement: categoryOrder.map((category, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: categoryLabels[category],
      description: `${(categoryCounts[category] ?? 0).toLocaleString("de-DE")} spielbare Aufgaben`
    }))
  }
};

export default function OrtskatalogPage() {
  return (
    <>
      <JsonLd data={catalogStructuredData} />
      <InfoPageShell
        eyebrow="Spielinhalte und Quellen"
        title="Welche Orte und Aufgaben gibt es bei Punktlandung?"
        intro={`Diese Seite zeigt, welche Inhalte im Spiel vorkommen: aktuell ${builtInLocations.length.toLocaleString("de-DE")} spielbare Aufgaben mit Städten, Hauptstädten, Wahrzeichen, Landschaften und Flaggen. Außerdem erklären wir, wie die Motive ausgewählt und geprüft werden.`}
      >
      <p className="text-sm text-slate-400">Datenstand der Katalogversion: Juli 2026</p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-md bg-slate-950/72 p-5 ring-1 ring-slate-700">
          <p className="text-4xl font-black text-emerald-300">{builtInLocations.length.toLocaleString("de-DE")}</p>
          <h2 className="mt-2 text-lg font-black text-white">spielbare Aufgaben</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Nach Duplikat-, Lizenz- und Motivfiltern.</p>
        </div>
        <div className="rounded-md bg-slate-950/72 p-5 ring-1 ring-slate-700">
          <p className="text-4xl font-black text-indigo-300">{countryCount.toLocaleString("de-DE")}</p>
          <h2 className="mt-2 text-lg font-black text-white">Länder und Gebiete</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Über eindeutige Ländercodes im aktiven Katalog vertreten.</p>
        </div>
        <div className="rounded-md bg-slate-950/72 p-5 ring-1 ring-slate-700 sm:col-span-2 xl:col-span-1">
          <p className="text-4xl font-black text-amber-300">5</p>
          <h2 className="mt-2 text-lg font-black text-white">Kategorien</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Zusätzlich können alle Inhalte gemischt gespielt werden.</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] font-black leading-tight text-white">Verteilung auf die Kategorien</h2>
        <div className="mt-4 overflow-x-auto rounded-md ring-1 ring-slate-700">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-slate-200">
              <tr>
                <th className="px-4 py-3 font-black">Kategorie</th>
                <th className="px-4 py-3 text-right font-black">Spielbare Aufgaben</th>
                <th className="px-4 py-3 text-right font-black">Anteil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/72 text-slate-300">
              {categoryOrder.map((category) => {
                const count = categoryCounts[category] ?? 0;
                const share = (count / builtInLocations.length) * 100;
                return (
                  <tr key={category}>
                    <td className="px-4 py-3 font-bold text-white">{categoryLabels[category]}</td>
                    <td className="px-4 py-3 text-right">{count.toLocaleString("de-DE")}</td>
                    <td className="px-4 py-3 text-right">{share.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] font-black leading-tight text-white">Wie kommt ein Motiv in den spielbaren Katalog?</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            ["1. Quelle und Lizenz", "Die aktiven Bildaufgaben verwenden Wikimedia-Commons-Motive. Quellen und Lizenzangaben werden im Projektkatalog mitgeführt."],
            ["2. Eindeutiger Ort", "Jeder Eintrag enthält Koordinaten sowie Angaben zu Land, Kontinent und Kategorie, damit Tipp und Ziel vergleichbar sind."],
            ["3. Motivfilter", "Karten, Diagramme, Montagen, Satellitenbilder und ungeeignete niedrig priorisierte Motive werden aus dem Standardkatalog gefiltert."],
            ["4. Technische Prüfung", "Doppelte Kategorie-ID-Kombinationen und Bilder mit bekannten Lizenzproblemen werden vor dem Spielbetrieb ausgeschlossen."]
          ].map(([title, body]) => (
            <article key={title} className="rounded-md bg-slate-950/72 p-5 ring-1 ring-slate-700">
              <h3 className="text-lg font-black text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-md border border-slate-700 bg-slate-950/60 p-5">
        <h2 className="text-[22px] font-black leading-tight text-white">Woher stammen die Inhalte?</h2>
        <p className="mt-2 leading-7 text-slate-300">
          Die Bilder stammen aus Wikimedia Commons. Die Lizenzseite nennt die verwendeten Daten- und Bildquellen und
          führt zu den einzelnen Bildnachweisen. Die Zahlen auf dieser Seite sind keine Marketing-Schätzung, sondern
          werden direkt aus dem aktiven Spieldatenbestand berechnet.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href="/lizenzen" tone="ghost" className="inline-flex w-fit items-center justify-center normal-case">
            Quellen und Lizenzen ansehen
          </ButtonLink>
          <ButtonLink href="/" tone="primary" className="inline-flex w-fit items-center justify-center normal-case">
            Punktlandung kostenlos starten
          </ButtonLink>
        </div>
      </section>
      </InfoPageShell>
    </>
  );
}
