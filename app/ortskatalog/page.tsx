import type { Metadata } from "next";
import { RedesignButtonLink } from "@/components/redesign";
import { InfoPageShell } from "@/components/InfoPageShell";
import { JsonLd } from "@/components/StructuredData";
import { builtInLocations, catalogInventoryLocations } from "@/data/locations";
import { buildCatalogStatistics, catalogCategoryLabels, catalogCategoryOrder } from "@/lib/catalogStatistics";
import { MINIMUM_DIFFICULTY_SAMPLES, STABLE_DIFFICULTY_SAMPLES } from "@/lib/locationDifficulty";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Welche Orte und Aufgaben gibt es bei Punktlandung?",
  description:
    "Welche Inhalte bietet Punktlandung? Übersicht über spielbare Orte, Flaggen, Kategorien, Länderabdeckung, Bildauswahl und Quellen.",
  alternates: {
    canonical: absoluteUrl("/ortskatalog")
  }
};

const catalogStatistics = buildCatalogStatistics(builtInLocations, catalogInventoryLocations);

const catalogStructuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": `${absoluteUrl("/ortskatalog")}#collection`,
  name: "Punktlandung-Ortskatalog",
  url: absoluteUrl("/ortskatalog"),
  description: `Übersicht über ${builtInLocations.length.toLocaleString("de-DE")} spielbare Orts- und Flaggenaufgaben in fünf Kategorien.`,
  inLanguage: "de-DE",
  dateModified: "2026-08-22",
  isPartOf: {
    "@id": `${absoluteUrl("/")}#website`
  },
  about: catalogCategoryOrder.map((category) => ({
    "@type": "Thing",
    name: catalogCategoryLabels[category]
  })),
  mainEntity: {
    "@type": "ItemList",
    name: "Spielbare Kategorien bei Punktlandung",
    numberOfItems: catalogCategoryOrder.length,
    itemListElement: catalogStatistics.categories.map((row, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: catalogCategoryLabels[row.category],
      description: `${row.total.toLocaleString("de-DE")} spielbare Aufgaben`
    }))
  }
};

export default function OrtskatalogPage() {
  return (
    <>
      <JsonLd data={catalogStructuredData} />
      <InfoPageShell
        plainContent
        eyebrow="Spielinhalte und Quellen"
        title="Welche Orte und Aufgaben gibt es bei Punktlandung?"
        intro={`Diese Seite zeigt, welche Inhalte im Spiel vorkommen: aktuell ${builtInLocations.length.toLocaleString("de-DE")} spielbare Aufgaben mit Städten, Hauptstädten, Wahrzeichen, Landschaften und Flaggen. Außerdem erklären wir, wie die Motive ausgewählt und geprüft werden.`}
      >
      <p className="text-sm text-slate-400">Datenstand der Katalogversion: August 2026</p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="punktlandung-info-static-card rounded-md p-5">
          <p className="text-4xl font-black text-emerald-300">{builtInLocations.length.toLocaleString("de-DE")}</p>
          <h2 className="mt-2 text-lg font-black text-white">spielbare Aufgaben</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Aus {catalogStatistics.sourceTasks.toLocaleString("de-DE")} geprüften Quellen nach Qualitäts-, Lizenz- und Motivfiltern.
          </p>
        </div>
        <div className="punktlandung-info-static-card rounded-md p-5">
          <p className="text-4xl font-black text-indigo-300">{catalogStatistics.countriesAndTerritories.toLocaleString("de-DE")}</p>
          <h2 className="mt-2 text-lg font-black text-white">Länder und Gebiete</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Über eindeutige Ländercodes im aktiven Katalog vertreten.</p>
        </div>
        <div className="punktlandung-info-static-card rounded-md p-5 sm:col-span-2 xl:col-span-1">
          <p className="text-4xl font-black text-amber-300">5</p>
          <h2 className="mt-2 text-lg font-black text-white">Kategorien</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Zusätzlich können alle Inhalte gemischt gespielt werden.</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] font-black leading-tight text-white">Verteilung auf die Kategorien</h2>
        <div className="punktlandung-info-table mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-slate-200">
              <tr>
                <th className="px-4 py-3 font-black">Kategorie</th>
                <th className="px-4 py-3 text-right font-black">Spielbare Aufgaben</th>
                <th className="px-4 py-3 text-right font-black">Leicht</th>
                <th className="px-4 py-3 text-right font-black">Mittel</th>
                <th className="px-4 py-3 text-right font-black">Schwer</th>
                <th className="px-4 py-3 text-right font-black">Anteil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {catalogStatistics.categories.map((row) => {
                const share = (row.total / builtInLocations.length) * 100;
                return (
                  <tr key={row.category}>
                    <td className="px-4 py-3 font-bold text-white">{catalogCategoryLabels[row.category]}</td>
                    <td className="px-4 py-3 text-right">{row.total.toLocaleString("de-DE")}</td>
                    <td className="px-4 py-3 text-right">{row.easy.toLocaleString("de-DE")}</td>
                    <td className="px-4 py-3 text-right">{row.medium.toLocaleString("de-DE")}</td>
                    <td className="px-4 py-3 text-right">{row.hard.toLocaleString("de-DE")}</td>
                    <td className="px-4 py-3 text-right">{share.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="punktlandung-info-static-card mt-8 p-5">
        <h2 className="text-[22px] font-black leading-tight text-white">Wie verändert sich die Schwierigkeit?</h2>
        <p className="mt-2 leading-7 text-slate-300">
          Die Tabelle zeigt die Startverteilung des aktiven Katalogs. Sobald ein Motiv mindestens {MINIMUM_DIFFICULTY_SAMPLES} vergleichbare,
          serververifizierte Runden gesammelt hat, kann seine Einstufung anhand von Punktzahl, Ländertreffern und
          relativer Antwortzeit automatisch angepasst werden. Ab {STABLE_DIFFICULTY_SAMPLES} Runden gilt die Einstufung als stabil. Die
          Auswertung wird einmal täglich aktualisiert, sofern der Datenbank-Zeitplan aktiv ist.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] font-black leading-tight text-white">Wie kommt ein Motiv in den spielbaren Katalog?</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            ["1. Quelle und Lizenz", "Die aktiven Bildaufgaben verwenden Wikimedia-Commons-Motive. Quellen und Lizenzangaben werden im Projektkatalog mitgeführt."],
            ["2. Eindeutiger Ort", "Jeder Eintrag enthält Koordinaten sowie Angaben zu Land, Kontinent und Kategorie, damit Tipp und Ziel vergleichbar sind."],
            ["3. Motiv und Aktualität", "Aktiv bleiben nur eindeutig passende Fotografien ab Aufnahmejahr 2010. Zeichnungen, Karten, Montagen, Satellitenbilder, Innenräume und irreführende Motive werden ausgeschlossen."],
            ["4. Technische Prüfung", "Die Quelldatei muss mindestens 2.560 × 1.440 Pixel und ein geeignetes Querformat besitzen. So nutzt das Spiel auf Handy, Laptop und TV dasselbe hochwertige Masterbild mit einer passenden Wikimedia-Ableitung."]
          ].map(([title, body]) => (
            <article key={title} className="punktlandung-info-static-card rounded-md p-5">
              <h3 className="text-lg font-black text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="punktlandung-info-static-card mt-8 p-5">
        <h2 className="text-[22px] font-black leading-tight text-white">Woher stammen die Inhalte?</h2>
        <p className="mt-2 leading-7 text-slate-300">
          Die Bilder stammen aus Wikimedia Commons. Die Lizenzseite nennt die verwendeten Daten- und Bildquellen und
          führt zu den einzelnen Bildnachweisen. Die Zahlen auf dieser Seite sind keine Marketing-Schätzung, sondern
          werden direkt aus dem aktiven Spieldatenbestand berechnet.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <RedesignButtonLink href="/lizenzen" tone="secondary" className="inline-flex w-fit items-center justify-center">
            Quellen und Lizenzen ansehen
          </RedesignButtonLink>
          <RedesignButtonLink href="/" tone="primary" className="inline-flex w-fit items-center justify-center">
            Punktlandung kostenlos starten
          </RedesignButtonLink>
        </div>
      </section>
      </InfoPageShell>
    </>
  );
}
