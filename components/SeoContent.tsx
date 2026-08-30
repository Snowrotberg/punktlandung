import { faqItems } from "@/lib/seo";
import Link from "next/link";

type FaqCardsProps = {
  limit?: number;
  columns?: boolean;
  headingLevel?: "h2" | "h3";
};

export function FaqCards({ limit, columns = false, headingLevel = "h2" }: FaqCardsProps) {
  const items = typeof limit === "number" ? faqItems.slice(0, limit) : faqItems;
  const Heading = headingLevel;

  return (
    <div className={`grid gap-4 ${columns ? "md:grid-cols-2" : ""}`}>
      {items.map((item) => (
        <article key={item.question} className="punktlandung-info-static-card rounded-xl p-5">
          <Heading className="text-[22px] font-black leading-tight text-white">{item.question}</Heading>
          <p className="mt-3 leading-7 text-slate-300">{item.answer}</p>
        </article>
      ))}
    </div>
  );
}

export function HomeSeoContent() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Das steckt im Spiel</p>
          <h2 className="mt-2 text-3xl leading-tight text-white">Ein Kartenquiz, bei dem auch ein Beinahetreffer zählt</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Punktlandung ist ein kostenloses, deutschsprachiges Geografie-Spiel im Browser. In jeder Runde siehst du
            ein Bild oder eine geografische Aufgabe und setzt anschließend selbst einen Pin auf die Weltkarte. Anders
            als bei einem klassischen Multiple-Choice-Quiz entscheidet nicht nur „richtig oder falsch“: Das Spiel misst
            die Entfernung zwischen deinem Tipp und dem gesuchten Ziel.
          </p>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Eine exakte Punktlandung bringt 5.000 Punkte. Mit wachsender Entfernung sinkt die Wertung nach einer festen
            Formel. Nach dem Tipp zeigt die Auflösung beide Positionen, die Entfernung und deine Punkte. So erkennst du
            sofort, ob nur das Land stimmte oder ob du sogar in der richtigen Region gelandet bist.
          </p>
        </section>

        <section className="punktlandung-info-static-card rounded-xl p-5 md:p-6">
          <h2 className="text-xl leading-tight text-white">Was kannst du erraten?</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-300 sm:grid-cols-2 lg:grid-cols-1">
            <li><strong className="text-white">Städte und Hauptstädte:</strong> ordne bekannte und weniger bekannte Orte auf der Karte ein.</li>
            <li><strong className="text-white">Wahrzeichen:</strong> finde den Standort eines Bauwerks oder einer Sehenswürdigkeit.</li>
            <li><strong className="text-white">Landschaften:</strong> erkenne Naturmotive und ihre geografische Lage.</li>
            <li><strong className="text-white">Flaggen:</strong> wähle das Land direkt auf der Karte.</li>
            <li><strong className="text-white">Gemischt:</strong> spiele alle verfügbaren Aufgabentypen in einer Partie.</li>
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-2xl leading-tight text-white">Drei Spielweisen, ein transparentes Regelwerk</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <article className="punktlandung-info-static-card rounded-xl p-5">
            <h3 className="text-lg font-bold text-white">Solo</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Spiele eine kurze Runde allein, passe Kategorie, Schwierigkeit, Zeit und Rundenzahl an und vergleiche deine Ergebnisse.</p>
          </article>
          <article className="punktlandung-info-static-card rounded-xl p-5">
            <h3 className="text-lg font-bold text-white">Party</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Bis zu zehn Personen tippen reihum am selben Gerät. Nach jeder Runde seht ihr, wer dem Ziel am nächsten kam.</p>
          </article>
          <article className="punktlandung-info-static-card rounded-xl p-5">
            <h3 className="text-lg font-bold text-white">Online-Raum</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Erstelle einen Raum oder tritt per Code bei und spiele mit Freunden an unterschiedlichen Geräten.</p>
          </article>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl leading-tight text-white">Woher kommen Aufgaben und Bilder?</h2>
          <p className="mt-3 text-base leading-7 text-slate-300">
            Der aktive Aufgabenkatalog wird im Projekt gepflegt und vor der Auslieferung auf doppelte Einträge,
            Koordinaten und bekannte Lizenzprobleme geprüft. Bildaufgaben verwenden Motive aus Wikimedia Commons.
            Quellen und Lizenzangaben bleiben über den Bildnachweis und den öffentlichen Lizenzkatalog nachvollziehbar.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Punktlandung wird laufend weiterentwickelt. Fehlerhafte Zuordnungen oder ungeeignete Motive
            können über die Feedback-Seite gemeldet und anschließend aus dem Katalog entfernt werden.
          </p>
        </div>
        <div>
          <h2 className="text-2xl leading-tight text-white">Ohne Anmeldung ausprobieren</h2>
          <p className="mt-3 text-base leading-7 text-slate-300">
            Eine Gastpartie lässt sich ohne Konto starten. Ein Konto ist nur nötig, wenn abgeschlossene Partien im
            persönlichen Verlauf gespeichert oder technisch geprüfte Ergebnisse in Rankings berücksichtigt werden
            sollen. Welche Daten dabei verarbeitet werden, erklären die Datenschutzhinweise.
          </p>
        </div>
      </section>

      <nav className="mt-10 grid gap-3 md:grid-cols-3" aria-label="Vertiefende Informationen zu Punktlandung">
        <Link href="/so-funktioniert-punktlandung" className="punktlandung-help-card rounded-xl border p-4 no-underline">
          <h3 className="text-lg font-bold text-white">Spielablauf und Punkte</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Vier Schritte, die genaue Punkteformel und konkrete Entfernungsbeispiele.</p>
          <i className="punktlandung-card-arrow" aria-hidden="true">›</i>
        </Link>
        <Link href="/ortskatalog" className="punktlandung-help-card rounded-xl border p-4 no-underline">
          <h3 className="text-lg font-bold text-white">Orte, Aufgaben und Quellen</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Aktuelle Katalogzahlen, Kategorien, Länderabdeckung und Auswahlverfahren.</p>
          <i className="punktlandung-card-arrow" aria-hidden="true">›</i>
        </Link>
        <Link href="/partyspiel-geografie" className="punktlandung-help-card rounded-xl border p-4 no-underline">
          <h3 className="text-lg font-bold text-white">Mit Freunden spielen</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Vorbereitung, passende Einstellungen und Ablauf für gemeinsame Runden.</p>
          <i className="punktlandung-card-arrow" aria-hidden="true">›</i>
        </Link>
      </nav>

      <section className="mt-10">
        <h2 className="text-2xl leading-tight text-white">Häufige Fragen</h2>
        <div className="mt-4"><FaqCards limit={4} columns headingLevel="h3" /></div>
      </section>
    </div>
  );
}
