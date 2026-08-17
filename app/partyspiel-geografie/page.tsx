import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageShell } from "@/components/InfoPageShell";
import { RedesignButtonLink } from "@/components/redesign";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Geografie-Partyspiel für gemeinsame Runden",
  description:
    "So funktioniert Punktlandung als Geografie-Partyspiel: Gruppengröße, Vorbereitung, passende Einstellungen, Ablauf und Tipps für gemeinsame Runden.",
  alternates: {
    canonical: absoluteUrl("/partyspiel-geografie")
  }
};

const setupSteps = [
  ["1", "Spieler eintragen", "Gebt bis zu zehn Namen ein. Ein Konto ist für eine lokale Partyrunde nicht erforderlich."],
  ["2", "Runde einstellen", "Wählt Kategorie, Schwierigkeit, Zeitlimit und Rundenzahl passend zu eurer Gruppe."],
  ["3", "Gerät weitergeben", "Alle sehen dieselbe Aufgabe und setzen ihren Tipp nacheinander auf derselben Karte."],
  ["4", "Auflösung vergleichen", "Nach jedem Durchgang zeigt Punktlandung Ziel, Entfernung und Punkte aller Mitspielenden."]
] as const;

export default function PartyspielGeografiePage() {
  return (
    <InfoPageShell
      plainContent
      eyebrow="Gemeinsam am selben Bildschirm"
      title="Punktlandung als Geografie-Partyspiel"
      intro="Im Party-Modus spielen zwei bis zehn Personen an einem Gerät. Jede Aufgabe ist für alle gleich, die Tipps werden reihum abgegeben und anschließend gemeinsam aufgelöst."
    >
      <p className="text-sm text-slate-400">Inhaltlich geprüft: 9. August 2026</p>

      <section className="mt-6">
        <h2 className="text-[22px] leading-tight text-white">So bereitet ihr eine Partie vor</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-2">
          {setupSteps.map(([number, title, text]) => (
            <li key={number} className="punktlandung-info-static-card rounded-xl p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Schritt {number}</p>
              <h3 className="mt-1 text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] leading-tight text-white">Welche Einstellungen passen zu welcher Runde?</h2>
        <div className="punktlandung-info-table mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-slate-200">
              <tr>
                <th className="px-4 py-3 font-bold">Situation</th>
                <th className="px-4 py-3 font-bold">Runden</th>
                <th className="px-4 py-3 font-bold">Zeit</th>
                <th className="px-4 py-3 font-bold">Empfehlung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr><td className="px-4 py-3 font-bold text-white">Kurze Pause</td><td className="px-4 py-3">5</td><td className="px-4 py-3">30 Sekunden</td><td className="px-4 py-3">Gemischt, leicht oder mittel</td></tr>
              <tr><td className="px-4 py-3 font-bold text-white">Spieleabend</td><td className="px-4 py-3">10–15</td><td className="px-4 py-3">60 Sekunden</td><td className="px-4 py-3">Gemischt oder eine gemeinsame Lieblingskategorie</td></tr>
              <tr><td className="px-4 py-3 font-bold text-white">Geografie-Fans</td><td className="px-4 py-3">15</td><td className="px-4 py-3">30 oder 60 Sekunden</td><td className="px-4 py-3">Mittel oder schwer, ohne Diskussion vor dem Tipp</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Die Vorschläge sind keine Sonderregeln. Rundenzahl, Zeit und Schwierigkeit können vor jeder Partie frei
          kombiniert werden. Bei neuen Gruppen funktionieren fünf Proberunden meist besser als ein langer Einstieg.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="punktlandung-info-static-card rounded-xl p-5">
          <h2 className="text-xl text-white">Fair spielen am gemeinsamen Gerät</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Gebt das Gerät erst weiter, nachdem ein Tipp bestätigt wurde. Wer gerade tippt, sollte die Karte allein
            bedienen; Hinweise aus der Gruppe sind nur dann sinnvoll, wenn ihr ausdrücklich als Teams spielt. Bei
            Punktgleichheit kann die benötigte Tippzeit die Reihenfolge beeinflussen.
          </p>
        </article>
        <article className="punktlandung-info-static-card rounded-xl p-5">
          <h2 className="text-xl text-white">Gemeinsam statt gegeneinander</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Für eine kooperative Runde besprecht ihr den Ort vor jedem Tipp und lasst eine Person den gemeinsamen Pin
            setzen. Notiert euch als eigenes Ziel zum Beispiel 3.500 Punkte im Rundendurchschnitt. Das Spiel selbst
            wertet weiterhin einzelne Namen; die gemeinsame Zielmarke führt ihr als Hausregel.
          </p>
        </article>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] leading-tight text-white">Was passiert nach einem Tipp?</h2>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Die Auflösung verbindet den gesetzten Pin mit dem tatsächlichen Ziel und nennt die Entfernung. Eine exakte
          Punktlandung ergibt 5.000 Punkte; mit wachsender Entfernung sinkt die Wertung. Bei Flaggen zählt das korrekt
          getroffene Land. Die Gesamtwertung addiert die Punkte aller abgeschlossenen Runden.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Die genaue Formel und mehrere Entfernungsbeispiele stehen auf der Seite zum {" "}
          <Link href="/so-funktioniert-punktlandung" className="font-bold text-emerald-300 underline underline-offset-4">Spielablauf und Punktesystem</Link>.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <RedesignButtonLink href="/party-modus" tone="primary" className="w-fit">Party-Modus starten</RedesignButtonLink>
        <RedesignButtonLink href="/ortskatalog" tone="secondary" className="w-fit">Aufgaben und Quellen ansehen</RedesignButtonLink>
      </div>
    </InfoPageShell>
  );
}
