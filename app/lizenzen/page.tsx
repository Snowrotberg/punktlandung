import Link from "next/link";
import { BackIcon } from "@/components/BackIcon";

export default function LizenzenPage() {
  return (
    <main className="min-h-dvh bg-slate-950 p-4 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-md bg-slate-900/78 p-5 ring-1 ring-slate-700">
        <Link href="/" aria-label="Zurueck" title="Zurueck" className="punktlandung-back-link">
          <BackIcon />
        </Link>
        <h1 className="mt-5 text-4xl font-black text-white">Lizenzen und Quellen</h1>
        <p className="mt-4 text-slate-300">
          Punktlandung nutzt freie Karten-, Daten- und Bildquellen. Diese Seite nennt die wichtigsten Quellen und weiterfuehrende
          Lizenzinformationen.
        </p>

        <div className="mt-6 space-y-5 text-sm leading-6 text-slate-300">
          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Karten</h2>
            <p className="mt-2">
              Kartenmaterial: OpenStreetMap-Mitwirkende. Die jeweils verwendete Kachelquelle wird in der Kartenansicht ueber die
              Leaflet-Attribution angezeigt.
            </p>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              OpenStreetMap Copyright und Lizenz
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Laendergrenzen</h2>
            <p className="mt-2">
              Fuer Flaggenrunden nutzt Punktlandung einen lokalen GeoJSON-Laenderdatensatz, damit Treffer im richtigen Land ohne externe
              Geocoding-Abfrage erkannt werden koennen.
            </p>
            <a href="https://github.com/datasets/geo-countries" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              Geo Countries Dataset
            </a>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Bilder</h2>
            <p className="mt-2">
              Ratebilder stammen aus freien Quellen, unter anderem aus Wikimedia Commons und Wikidata. Bild- und Quellenangaben werden so
              eingebunden, dass sie die laufende Runde nicht vorzeitig aufloesen.
            </p>
            <a href="https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-emerald-300 hover:text-emerald-200">
              Wikimedia Commons: Inhalte weiterverwenden
            </a>
          </section>
        </div>
      </section>
    </main>
  );
}
