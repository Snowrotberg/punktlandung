import Link from "next/link";
import { BackIcon } from "@/components/BackIcon";

export default function ImpressumPage() {
  return (
    <main className="min-h-dvh bg-slate-950 p-4 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-md bg-slate-900/78 p-5 ring-1 ring-slate-700">
        <Link href="/" aria-label="Zurueck" title="Zurueck" className="punktlandung-back-link">
          <BackIcon />
        </Link>
        <h1 className="mt-5 text-4xl font-black text-white">Impressum</h1>

        <div className="mt-6 space-y-5 text-sm leading-6 text-slate-300">
          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Angaben gemaess § 5 DDG</h2>
            <p className="mt-2">
              Punktlandung
              <br />
              Inhaber: [Vorname Nachname]
              <br />
              [Strasse Hausnummer]
              <br />
              [PLZ Ort]
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Kontakt</h2>
            <p className="mt-2">E-Mail: [deine E-Mail-Adresse]</p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Verantwortlich fuer den Inhalt</h2>
            <p className="mt-2">
              [Vorname Nachname]
              <br />
              [Strasse Hausnummer]
              <br />
              [PLZ Ort]
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Verbraucherstreitbeilegung</h2>
            <p className="mt-2">
              Ich nehme nicht an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teil und bin hierzu auch nicht verpflichtet.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
