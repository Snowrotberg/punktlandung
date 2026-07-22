import { InfoPageShell } from "@/components/InfoPageShell";
import { ImageLicenseCatalog } from "@/components/ImageLicenseCatalog";

export default function LizenzenPage() {
  return (
    <InfoPageShell
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
              Kartenmaterial: OpenStreetMap-Mitwirkende. Die jeweils verwendete Kachelquelle wird in der Kartenansicht über die
              Leaflet-Attribution angezeigt.
            </p>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              OpenStreetMap Copyright und Lizenz
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Ländergrenzen</h2>
            <p className="mt-2">
              Für Flaggenrunden nutzt Punktlandung einen lokalen GeoJSON-Länderdatensatz, damit Treffer im richtigen Land ohne externe
              Geocoding-Abfrage erkannt werden können.
            </p>
            <a href="https://github.com/datasets/geo-countries" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              Geo Countries Dataset
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

          <ImageLicenseCatalog />
      </div>
    </InfoPageShell>
  );
}
