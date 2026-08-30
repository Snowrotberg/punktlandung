import type { Metadata } from "next";
import { RedesignButtonLink } from "@/components/redesign";
import { InfoPageShell } from "@/components/InfoPageShell";
import { JsonLd } from "@/components/StructuredData";
import { GameFlowDiagram, ScoreDiagram } from "@/components/EditorialExplainers";
import { absoluteUrl } from "@/lib/seo";
import { HelpBackLink } from "@/components/HelpBackLink";
import { Clock3, Gauge, Globe2, ListOrdered, SlidersHorizontal, UserRound, UsersRound } from "lucide-react";

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
      <HelpBackLink />

      <section id="spielablauf" className="scroll-mt-24">
        <GameFlowDiagram />
      </section>

      <section id="punkte" className="mt-8 scroll-mt-24">
        <h2 className="text-[22px] font-black leading-tight text-white">Wie werden die Punkte berechnet?</h2>
        <p className="mt-3 leading-7 text-slate-300">
          Eine exakte Punktlandung ergibt 5.000 Punkte. Danach sinkt die Punktzahl mit der Entfernung exponentiell.
          Im Spiel wird die Formel <strong className="text-white">5.000 × e<sup>−Entfernung/1.850</sup></strong> verwendet
          und auf eine ganze Zahl gerundet.
        </p>
        <ScoreDiagram />

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

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="punktlandung-info-static-card rounded-xl p-5">
            <h3 className="text-lg font-black text-white">Ein konkretes Beispiel</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Ein Tipp in 500 Kilometern Entfernung bringt 3.816 Punkte. Zehn gleich gute Runden ergeben zusammen
              38.160 Punkte.
            </p>
          </article>
          <article className="punktlandung-info-static-card rounded-xl p-5">
            <h3 className="text-lg font-black text-white">Faire Vergleiche</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Rankings vergleichen Punkte pro Runde. So bleiben Partien mit unterschiedlicher Rundenzahl
              vergleichbar; Kategorie und Einstellungen werden bei jeder Platzierung sichtbar ausgewiesen.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] font-black leading-tight text-white">Welche Einstellungen kannst du wählen?</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            { title: "Kategorie", body: "Spiele gemischt oder konzentriere dich auf Städte, Hauptstädte, Wahrzeichen, Landschaften oder Flaggen.", Icon: SlidersHorizontal },
            { title: "Rundenzahl", body: "Kurze Partien eignen sich zum Kennenlernen. Mehr Runden machen das Gesamtergebnis aussagekräftiger.", Icon: ListOrdered },
            { title: "Zeit", body: "Ein festes Zeitlimit belohnt schnelle Entscheidungen. Mit freier Zeit kannst du Bild und Karte in Ruhe prüfen.", Icon: Clock3 },
            { title: "Schwierigkeit", body: "Leichte Aufgaben sind oft klarer erkennbar; schwere Motive verlangen genaueres Hinsehen und mehr Ortswissen.", Icon: Gauge }
          ].map(({ title, body, Icon }) => (
            <article key={title} className="punktlandung-info-static-card rounded-xl p-5">
              <h3 className="flex items-center gap-3 text-lg font-black text-white"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] font-black leading-tight text-white">Welche Spielmodi gibt es?</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { title: "Solo", body: "Du spielst allein und setzt alle Tipps selbst. Ideal zum Üben und für persönliche Bestwerte.", Icon: UserRound },
            { title: "Party", body: "Zwei bis zehn Personen spielen reihum am selben Gerät und vergleichen jede Auflösung gemeinsam.", Icon: UsersRound },
            { title: "Online-Raum", body: "Bis zu zehn Personen treten über einen gemeinsamen Raumcode auf ihren eigenen Geräten an.", Icon: Globe2 }
          ].map(({ title, body, Icon }) => (
            <article key={title} className="punktlandung-info-static-card rounded-xl p-5">
              <h3 className="flex items-center gap-3 text-lg font-black text-white"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
            </article>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Alle Modi lassen sich ohne Anmeldung ausprobieren. Ein Konto brauchst du erst für einen dauerhaften
          persönlichen Verlauf und öffentliche Rankings.
        </p>
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
