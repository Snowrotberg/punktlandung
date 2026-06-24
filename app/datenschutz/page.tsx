import Link from "next/link";

export default function DatenschutzPage() {
  return (
    <main className="min-h-dvh bg-slate-950 p-4 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-md bg-slate-900/78 p-5 ring-1 ring-slate-700">
        <Link href="/" className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300 hover:text-emerald-200">
          Zurueck zur Startseite
        </Link>
        <h1 className="mt-5 text-4xl font-black text-white">Datenschutz</h1>
        <p className="mt-4 text-slate-300">
          Diese Datenschutzerklaerung informiert darueber, welche Daten Punktlandung verarbeitet, wenn das Spiel im Browser genutzt wird.
        </p>

        <div className="mt-6 space-y-5 text-sm leading-6 text-slate-300">
          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Verantwortlicher</h2>
            <p className="mt-2">Punktlandung</p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Lokale Spieldaten</h2>
            <p className="mt-2">
              Punktlandung speichert Nickname, Spielstand und Sitzungsdaten lokal im Browser. Diese Daten helfen dabei, ein Spiel nach einem
              versehentlichen Schliessen fortzusetzen oder lokale Einstellungen beizubehalten.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Server und Online-Raeume</h2>
            <p className="mt-2">
              Der aktuelle Browser-Modus kann ohne Benutzerkonto genutzt werden. Wenn Online-Funktionen aktiv sind, koennen Raumcode, Nickname,
              Tipps, Punkte und technische Verbindungsdaten verarbeitet werden, damit die Spielrunde funktioniert.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Kartendienste und Bildquellen</h2>
            <p className="mt-2">
              Punktlandung laedt Kartenkacheln und freie Bilder aus externen Quellen wie OpenStreetMap-nahen Tile-Diensten und Wikimedia
              Commons. Dabei kann die IP-Adresse technisch an diese Anbieter uebermittelt werden.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Werbung</h2>
            <p className="mt-2">
              Punktlandung kann Werbeflaechen anzeigen. Personenbezogene Werbung oder vergleichbares Tracking wird nur eingesetzt, wenn die
              dafuer erforderliche Einwilligung vorliegt.
            </p>
          </section>

          <section>
            <h2 className="text-[22px] font-black leading-tight text-white">Rechte der Nutzer</h2>
            <p className="mt-2">
              Nutzer koennen Auskunft, Berichtigung, Loeschung, Einschraenkung der Verarbeitung und Widerspruch geltend machen.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
