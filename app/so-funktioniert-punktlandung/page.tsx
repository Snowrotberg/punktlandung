import type { Metadata } from "next";
import { RedesignButtonLink } from "@/components/redesign";
import { InfoPageShell } from "@/components/InfoPageShell";
import { JsonLd } from "@/components/StructuredData";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Wie funktioniert Punktlandung? Spielablauf und Punkte",
  description:
    "So funktioniert Punktlandung: Ort erkennen, Tipp auf der Karte setzen und bis zu 5.000 Punkte nach Entfernung sammeln.",
  alternates: {
    canonical: absoluteUrl("/so-funktioniert-punktlandung")
  }
};

const scoreExamples = [
  { distance: "0 km", points: "5.000" },
  { distance: "10 km", points: "4.973" },
  { distance: "100 km", points: "4.737" },
  { distance: "500 km", points: "3.816" },
  { distance: "1.000 km", points: "2.912" },
  { distance: "2.000 km", points: "1.696" },
  { distance: "5.000 km", points: "335" }
];

const howToStructuredData = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "@id": `${absoluteUrl("/so-funktioniert-punktlandung")}#spielablauf`,
  name: "Wie funktioniert Punktlandung?",
  description:
    "In vier Schritten einen Ort einschätzen, den Tipp auf der Karte setzen und bis zu 5.000 Punkte sammeln.",
  inLanguage: "de-DE",
  url: absoluteUrl("/so-funktioniert-punktlandung"),
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Hinweis ansehen",
      text: "Sieh dir das Bild oder die geografische Aufgabe aus der gewählten Kategorie an."
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Ort einschätzen",
      text: "Suche auf der Weltkarte die Stelle, an der du das gezeigte Ziel vermutest."
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Pin setzen",
      text: "Setze deinen Kartentipp für die aktuelle Runde."
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Ergebnis vergleichen",
      text: "Vergleiche Ziel, Entfernung und die erreichten Punkte."
    }
  ]
};

export default function SoFunktioniertPunktlandungPage() {
  return (
    <>
      <JsonLd data={howToStructuredData} />
      <InfoPageShell
        plainContent
        eyebrow="Spielregeln und Methodik"
        title="Wie funktioniert Punktlandung?"
        intro="Punktlandung zeigt dir einen Ort, ein Wahrzeichen, eine Landschaft, eine Stadt oder eine Flagge. Du setzt deinen Tipp auf der Weltkarte. Je kleiner die Entfernung zum Ziel, desto mehr der maximal 5.000 Punkte erhältst du."
      >
      <p className="text-sm text-slate-400">Inhaltlich geprüft: 28. Juli 2026</p>

      <section className="mt-6">
        <h2 className="text-[22px] font-black leading-tight text-white">Eine Runde in vier Schritten</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["1", "Hinweis ansehen", "Du siehst ein Bild oder eine geografische Aufgabe aus der gewählten Kategorie."],
            ["2", "Ort einschätzen", "Du suchst auf der Weltkarte die Stelle, an der du das gezeigte Ziel vermutest."],
            ["3", "Pin setzen", "Dein Kartentipp wird für die aktuelle Runde gespeichert."],
            ["4", "Ergebnis vergleichen", "Punktlandung zeigt Ziel, Entfernung und erreichte Punkte."]
          ].map(([number, title, body]) => (
            <li key={number} className="punktlandung-info-static-card--translucent rounded-md p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Schritt {number}</p>
              <h3 className="mt-1 text-lg font-black text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] font-black leading-tight text-white">Wie werden die Punkte berechnet?</h2>
        <p className="mt-3 leading-7 text-slate-300">
          Eine exakte Punktlandung ergibt 5.000 Punkte. Danach sinkt die Punktzahl mit der Entfernung exponentiell.
          Im Spiel wird die Formel <strong className="text-white">5.000 × e<sup>−Entfernung/1.850</sup></strong> verwendet
          und auf eine ganze Zahl gerundet.
        </p>

        <div className="punktlandung-info-table mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-slate-200">
              <tr>
                <th className="px-4 py-3 font-black">Entfernung zum Ziel</th>
                <th className="px-4 py-3 font-black">Punkte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {scoreExamples.map((example) => (
                <tr key={example.distance}>
                  <td className="px-4 py-3">{example.distance}</td>
                  <td className="px-4 py-3 font-bold text-white">{example.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Sonderfall Flaggen: Wird das richtige Land getroffen, vergibt Punktlandung 5.000 Punkte. Die angezeigten
          Beispiele sind direkt aus der im Spiel verwendeten Bewertungsfunktion berechnet.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] font-black leading-tight text-white">Welche Spielmodi gibt es?</h2>
        <div className="punktlandung-info-table mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-slate-200">
              <tr>
                <th className="px-4 py-3 font-black">Modus</th>
                <th className="px-4 py-3 font-black">Personen</th>
                <th className="px-4 py-3 font-black">Ablauf</th>
                <th className="px-4 py-3 font-black">Anmeldung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr>
                <td className="px-4 py-3 font-bold text-white">Solo</td>
                <td className="px-4 py-3">1</td>
                <td className="px-4 py-3">Alle Tipps selbst setzen</td>
                <td className="px-4 py-3">nicht erforderlich</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-white">Party</td>
                <td className="px-4 py-3">2–10</td>
                <td className="px-4 py-3">Reihum am selben Bildschirm</td>
                <td className="px-4 py-3">nicht erforderlich</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-white">Online-Raum</td>
                <td className="px-4 py-3">bis zu 10</td>
                <td className="px-4 py-3">Gemeinsamer Raum über einen Raumcode</td>
                <td className="px-4 py-3">nicht erforderlich</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="punktlandung-info-static-card mt-8 p-5">
        <h2 className="text-[22px] font-black leading-tight text-white">Direkt ausprobieren</h2>
        <p className="mt-2 leading-7 text-slate-300">
          Standardmäßig startet eine Partie mit 15 Runden und 60 Sekunden pro Runde. Kategorie, Rundenzahl und Zeit
          lassen sich in den Spieleinstellungen anpassen.
        </p>
        <div className="mt-4 flex">
          <RedesignButtonLink href="/" tone="primary" className="inline-flex w-fit items-center justify-center">
            Punktlandung kostenlos starten
          </RedesignButtonLink>
        </div>
      </section>
      </InfoPageShell>
    </>
  );
}
