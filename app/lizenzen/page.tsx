import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";
import { ImageLicenseCatalog } from "@/components/ImageLicenseCatalog";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Lizenzen und Quellen",
  alternates: { canonical: absoluteUrl("/lizenzen") }
};

export default async function LizenzenPage({ searchParams }: { searchParams: Promise<{ bild?: string; gruppe?: string }> }) {
  const { bild, gruppe } = await searchParams;
  return (
    <InfoPageShell
      contentClassName="punktlandung-legal-panel"
      eyebrow="Rechtliches"
      title="Lizenzen und Quellen"
      intro="Freie Karten-, Daten- und Bildquellen sowie die vollständigen Lizenzinformationen."
    >
      <p className="text-slate-300">
          Punktlandung nutzt freie Karten-, Daten- und Bildquellen. Diese Seite nennt die Quellen und vollständigen
          Lizenzinformationen.
        </p>

      <div className="mt-6 space-y-5 text-sm leading-6 text-slate-300">
          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Karten</h2>
            <p className="mt-2">
              Die Kartendaten stammen von den OpenStreetMap-Mitwirkenden und stehen unter der Open Data Commons
              Open Database License (ODbL). Die Vektorkacheln werden von OpenFreeMap auf Grundlage des freien
              OpenMapTiles-Schemas bereitgestellt und mit einem eigenen Punktlandung-Style dargestellt. Die
              Quellenhinweise erscheinen zusätzlich direkt in jeder Kartenansicht.
            </p>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              OpenStreetMap Copyright und Lizenz
            </a>
            <span className="mx-2 text-slate-600">·</span>
            <a href="https://openfreemap.org/" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              OpenFreeMap
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Ländergrenzen</h2>
            <p className="mt-2">
              Für Flaggenrunden nutzt Punktlandung einen lokalen GeoJSON-Länderdatensatz, damit Treffer im richtigen Land ohne externe
              Geocoding-Abfrage erkannt werden können. Das Geo-Countries-Dataset steht unter der Open Data Commons
              Public Domain Dedication and License (PDDL); die zugrunde liegenden Natural-Earth-Daten sind gemeinfrei.
            </p>
            <a href="https://github.com/datasets/geo-countries" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              Geo Countries Dataset
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Kartensoftware</h2>
            <p className="mt-2">
              MapLibre GL JS rendert den eigenen Vektorkartenstil. Leaflet bleibt für Spiellogik, Pins,
              Beschriftungen und Ergebnislinien im Einsatz. Beide Projekte sind freie Software.
            </p>
            <a href="https://github.com/Leaflet/Leaflet/blob/main/LICENSE" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              Leaflet-Lizenz
            </a>
            <span className="mx-2 text-slate-600">·</span>
            <a href="https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              MapLibre-GL-JS-Lizenz
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Bilder</h2>
            <p className="mt-2">
              Ratebilder stammen aus freien Quellen, unter anderem aus Wikimedia Commons und Wikidata. Bild- und Quellenangaben werden so
              eingebunden, dass sie die laufende Runde nicht vorzeitig auflösen. Während des Ratens erscheint deshalb nur der neutrale
              Quellenhinweis „Wikimedia Commons“. Die vollständigen Einzelnachweise stehen ausschließlich in diesem Katalog.
            </p>
            <a href="https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              Wikimedia Commons: Inhalte weiterverwenden
            </a>
          </section>

          <ImageLicenseCatalog selectedFile={bild} selectedGroup={gruppe} />
      </div>
    </InfoPageShell>
  );
}
