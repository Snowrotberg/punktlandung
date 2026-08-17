import type { Metadata } from "next";
import { BookOpenCheck, CircleHelp, Gamepad2, Globe2, Images, Megaphone, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { ContributionPaths } from "@/components/ContributionPaths";
import { InfoPageShell } from "@/components/InfoPageShell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Über Punktlandung – Spielidee, Inhalte und Web-Version",
  description:
    "Hintergründe zu Punktlandung: Spielidee, redaktionell gepflegter Aufgabenkatalog, Web-Version, Finanzierung und Kontaktmöglichkeiten.",
  alternates: {
    canonical: absoluteUrl("/infos")
  }
};

const infoLinks = [
  ["/so-funktioniert-punktlandung", "Spielregeln und Wertung", "Der vollständige Ablauf, die Punkteformel und konkrete Entfernungsbeispiele.", BookOpenCheck],
  ["/ortskatalog", "Aufgabenkatalog und Quellen", "Aktuelle Bestandszahlen, Kategorien, Länderabdeckung, Auswahl und Bildquellen.", Images],
  ["/partyspiel-geografie", "Mit Freunden spielen", "Vorbereitung, Einstellungen und faire Regeln für gemeinsame Partien.", Users],
  ["/faq", "Hilfe und häufige Fragen", "Antworten zu Spielablauf, Konten, gespeicherten Partien und Rankings.", CircleHelp]
] as const;

function IconHeading({ Icon, children }: { Icon: typeof Gamepad2; children: React.ReactNode }) {
  return <h2 className="flex items-center gap-3 text-[22px] leading-tight text-white"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{children}</h2>;
}

export default function InfosPage() {
  return (
    <InfoPageShell
      fillDesktop
      plainContent
      eyebrow="Über das Projekt"
      title="Was ist Punktlandung?"
      intro="Punktlandung ist ein eigenständig entwickeltes Geografie-Spiel für den Browser. Hier erklären wir, was das Projekt anbietet, wie die Inhalte gepflegt werden und wie die Web-Version weiterentwickelt wird."
    >
      <p className="text-sm text-slate-400">Zuletzt aktualisiert: 9. August 2026</p>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="punktlandung-info-static-card rounded-xl p-5">
          <IconHeading Icon={Gamepad2}>Die Spielidee</IconHeading>
          <p className="mt-3 leading-7 text-slate-300">
            Statt aus vorgegebenen Antworten auszuwählen, setzt du selbst einen Pin auf die Weltkarte. Bilder,
            Flaggen, Städte, Hauptstädte, Landschaften und Wahrzeichen verlangen dabei unterschiedliche Arten von
            geografischem Wissen. Die Entfernung zum Ziel wird nach jeder Runde sichtbar und in Punkte übersetzt.
          </p>
        </article>
        <article className="punktlandung-info-static-card rounded-xl p-5">
          <IconHeading Icon={Users}>Für wen ist das Spiel gedacht?</IconHeading>
          <p className="mt-3 leading-7 text-slate-300">
            Punktlandung richtet sich an Einzelspieler, Familien, Freundesgruppen und alle, die Orte lieber auf einer
            Karte einordnen als Vokabeln abzufragen. Gastpartien funktionieren ohne Konto. Solo-, Party- und
            Online-Raum verwenden dasselbe nachvollziehbare Punktesystem.
          </p>
        </article>
      </section>

      <section className="mt-8">
        <IconHeading Icon={ShieldCheck}>Wie werden die Inhalte gepflegt?</IconHeading>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Die Aufgaben werden nicht automatisch aus beliebigen Webseiten übernommen. Der aktive Katalog wird im
          Projekt gepflegt und vor der Veröffentlichung auf eindeutige Koordinaten, doppelte Einträge, Kategorie,
          Länderzuordnung und bekannte Lizenzprobleme geprüft. Bilder stammen aus Wikimedia Commons; die zugehörigen
          Quellen und Lizenzen werden im öffentlichen Lizenzverzeichnis nachgewiesen. Katalogzahlen auf der
          Übersichtsseite werden direkt aus dem aktiven Spieldatenbestand berechnet.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="punktlandung-info-static-card rounded-xl p-5">
          <IconHeading Icon={Globe2}>Web-Version</IconHeading>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Das Spiel ist vollständig im Browser nutzbar und wird laufend weiterentwickelt. Funktionen, Aufgaben
            und Balancing werden anhand echter Spielrunden verbessert. Eine native App kann später ergänzend folgen.
          </p>
        </article>
        <article className="punktlandung-info-static-card rounded-xl p-5">
          <IconHeading Icon={Megaphone}>Finanzierung und Werbung</IconHeading>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Punktlandung kann kostenlos gespielt werden. Perspektivisch soll Werbung einen Teil der laufenden Kosten
            für Hosting, Karten- und Bildauslieferung decken. Informations-, Hilfe- und Rechtstexte stehen unabhängig
            davon im Vordergrund und werden nicht von Anzeigen unterbrochen.
          </p>
        </article>
      </section>

      <nav className="mt-8 grid gap-3 md:grid-cols-2" aria-label="Weiterführende Informationen">
        {infoLinks.map(([href, title, text, Icon]) => (
          <Link key={href} href={href} className="punktlandung-help-card rounded-xl border p-4 no-underline">
            <h2 className="flex items-center gap-3 text-lg text-white"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
            <i className="punktlandung-card-arrow" aria-hidden="true">›</i>
          </Link>
        ))}
      </nav>

      <section className="mt-8 border-t border-slate-800 pt-6">
        <IconHeading Icon={CircleHelp}>Fehler melden und Kontakt</IconHeading>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Falsche Zielorte, ungeeignete Bilder und technische Probleme kannst du direkt an das Punktlandung-Team melden.
          Verantwortliche Stelle und Kontaktadresse stehen im {" "}
          <Link href="/impressum" className="font-bold text-emerald-300 underline underline-offset-4">Impressum</Link>.
        </p>
        <ContributionPaths mode="feedback" />
      </section>
    </InfoPageShell>
  );
}
