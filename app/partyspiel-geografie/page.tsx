import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageShell } from "@/components/InfoPageShell";
import { RedesignButtonLink } from "@/components/redesign";
import { absoluteUrl } from "@/lib/seo";
import { HelpBackLink } from "@/components/HelpBackLink";
import { Globe2, ListChecks, SlidersHorizontal, Target, UsersRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Geografie-Partyspiel für gemeinsame Runden",
  description:
    "So funktioniert Punktlandung als Geografie-Partyspiel: Gruppengröße, Vorbereitung, passende Einstellungen, Ablauf und Tipps für gemeinsame Runden.",
  alternates: {
    canonical: absoluteUrl("/partyspiel-geografie")
  }
};

const setupSteps = [
  ["1", "Spieler eintragen", "Gebt bis zu zehn Namen ein. Ein Konto ist für eine lokale Partyrunde nicht erforderlich.", UsersRound],
  ["2", "Runde einstellen", "Wählt Kategorie, Schwierigkeit, Zeitlimit und Rundenzahl passend zu eurer Gruppe.", SlidersHorizontal],
  ["3", "Nacheinander tippen", "Alle sehen dieselbe Aufgabe und setzen ihren Tipp nacheinander auf derselben Karte.", ListChecks],
  ["4", "Auflösung vergleichen", "Nach jedem Durchgang zeigt Punktlandung Ziel, Entfernung und Punkte aller Mitspielenden.", Target]
] as const;

export default function PartyspielGeografiePage() {
  return (
    <InfoPageShell
      plainContent
      eyebrow="Gemeinsam am selben Bildschirm"
      title="Punktlandung als Geografie-Partyspiel"
      intro="Im Party-Modus spielen zwei bis zehn Personen an einem Gerät. Jede Aufgabe ist für alle gleich, die Tipps werden reihum abgegeben und anschließend gemeinsam aufgelöst."
      titleAction={<HelpBackLink />}
    >
      <section className="mt-6">
        <h2 className="text-[22px] leading-tight text-white">So bereitet ihr eine Partie vor</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-2">
          {setupSteps.map(([number, title, text, Icon]) => (
            <li key={number} className="punktlandung-info-static-card rounded-xl p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Schritt {number}</p>
              <h3 className="mt-1 flex items-center gap-3 text-lg font-bold text-white"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] leading-tight text-white">Party-Modus oder Online-Raum?</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="punktlandung-info-static-card rounded-xl p-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-white"><UsersRound aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />Party-Modus: gemeinsam an einem Bildschirm</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Ideal für Sofa, Unterricht oder Spieleabend. Ihr spielt an einem gemeinsamen Handy, Tablet, Notebook oder Fernseher. Jede Person ist nacheinander mit ihrem Tipp an der Reihe; die Auflösung seht ihr gemeinsam.
            </p>
          </article>
          <article className="punktlandung-info-static-card rounded-xl p-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-white"><Globe2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />Online-Raum: gemeinsam auf mehreren Geräten</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Wenn ihr getrennt sitzt oder jede Person am eigenen Gerät spielen soll, verbindet euch ein Raumcode mit derselben laufenden Partie.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px] leading-tight text-white">Welche Einstellungen passen zu welcher Runde?</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ["Kurze Runde", "5 Runden · 30 Sekunden", "Gemischt auf leicht oder mittel – gut zum Kennenlernen und für eine kurze Pause."],
            ["Spieleabend", "10–15 Runden · 60 Sekunden", "Gemischt oder eine gemeinsame Lieblingskategorie mit genug Zeit zum Überlegen."],
            ["Geografie-Fans", "15 Runden · 30 oder 60 Sekunden", "Mittel oder schwer – auf Wunsch ohne Zurufe, bevor ein Tipp bestätigt wurde."]
          ].map(([title, settings, body]) => (
            <article key={title} className="punktlandung-info-static-card rounded-xl p-5">
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 font-bold text-emerald-300">{settings}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
            </article>
          ))}
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
        <h2 className="text-[22px] leading-tight text-white">Auflösung und Punkte nachschlagen</h2>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Nach jedem Durchgang vergleicht ihr Ziel, Entfernung und Punkte. Den vollständigen Ablauf, die aktuelle
          Ergebnisdarstellung und die genaue Wertung findet ihr gesammelt unter {" "}
          <Link href="/so-funktioniert-punktlandung" className="font-bold text-emerald-300 underline underline-offset-4">Spielen &amp; Punkte</Link>.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <RedesignButtonLink href="/party-modus" tone="primary" className="w-fit">Party-Modus starten</RedesignButtonLink>
        <RedesignButtonLink href="/ortskatalog" tone="secondary" className="w-fit">Aufgaben und Quellen ansehen</RedesignButtonLink>
      </div>
    </InfoPageShell>
  );
}
