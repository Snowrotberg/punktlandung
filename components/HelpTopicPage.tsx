import { InfoPageShell } from "@/components/InfoPageShell";
import { RedesignButtonLink } from "@/components/redesign";
import { CircleUserRound, Clock3, Eye, Flag, Gauge, History, LockKeyhole, MapPin, Settings2, ShieldCheck, Sigma, Target, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";

export type HelpTopic = "spielablauf" | "punkte" | "konten" | "rankings";

const topicContent: Record<HelpTopic, {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; text: string; Icon: LucideIcon; href?: string; hrefLabel?: string }>;
}> = {
  spielablauf: {
    eyebrow: "Hilfe · Spielablauf",
    title: "So läuft eine Partie ab",
    intro: "Vom Spielmodus bis zur Auflösung – kompakt in vier Schritten.",
    sections: [
      { title: "1. Partie einstellen", text: "Wähle Solo, Party oder Online-Raum sowie Kategorie, Rundenzahl, Zeit und Schwierigkeit.", Icon: Settings2 },
      { title: "2. Aufgabe ansehen", text: "Erkenne den gezeigten Ort, die Stadt, Flagge, Landschaft oder das Wahrzeichen.", Icon: Eye },
      { title: "3. Tipp setzen", text: "Öffne die Karte, setze deinen Pin und bestätige deinen Tipp innerhalb der gewählten Zeit.", Icon: MapPin },
      { title: "4. Auflösung", text: "Nach jeder Runde siehst du Ziel, Entfernung und Punkte. Am Ende folgt die Gesamtwertung.", Icon: Flag, href: "/so-funktioniert-punktlandung", hrefLabel: "Ausführliche Spielregeln ansehen" }
    ]
  },
  punkte: {
    eyebrow: "Hilfe · Punkte",
    title: "So werden Punkte berechnet",
    intro: "Die Entfernung zum gesuchten Ziel entscheidet über deine Rundenwertung.",
    sections: [
      { title: "Bis zu 5.000 Punkte", text: "Je näher dein Pin am Ziel liegt, desto höher ist die Wertung. Ein Volltreffer bringt 5.000 Punkte.", Icon: Target },
      { title: "Gesamtpunktzahl", text: "Die Punkte aller abgeschlossenen Runden werden zur Gesamtpunktzahl der Partie addiert.", Icon: Sigma },
      { title: "Tippzeit bei Punktgleichheit", text: "Bei gleicher Punktzahl kann die benötigte Tippzeit über die Reihenfolge entscheiden.", Icon: Clock3 }
    ]
  },
  konten: {
    eyebrow: "Hilfe · Konten",
    title: "Spielen mit oder ohne Konto",
    intro: "Ein Konto ist freiwillig und wird erst für dauerhafte Spielstände benötigt.",
    sections: [
      { title: "Ohne Anmeldung spielen", text: "Alle können direkt loslegen. Ohne Konto bleibt das Ergebnis nur in der laufenden Sitzung verfügbar.", Icon: CircleUserRound },
      { title: "Automatisch speichern", text: "Bist du angemeldet, wird eine abgeschlossene Partie automatisch deinem persönlichen Spielverlauf zugeordnet.", Icon: History },
      { title: "Nach der Partie entscheiden", text: "Gäste können sich auf der Endkarte anmelden oder registrieren, wenn sie ihr Ergebnis dauerhaft übernehmen möchten.", Icon: LockKeyhole }
    ]
  },
  rankings: {
    eyebrow: "Hilfe · Rankings",
    title: "Persönlicher Verlauf und Rankings",
    intro: "Gespeichert bedeutet nicht automatisch öffentlich gewertet – beide Bereiche haben unterschiedliche Aufgaben.",
    sections: [
      { title: "Persönlicher Spielverlauf", text: "Jede vollständig abgeschlossene Partie eines angemeldeten Spielers wird automatisch privat gespeichert.", Icon: History },
      { title: "Welche Partien öffentlich zählen", text: "Für öffentliche Rankings zählen vollständig abgeschlossene und technisch geprüfte Partien mit festem Zeitlimit von 15, 30 oder 60 Sekunden. Partien mit freiem Zeitlimit werden nicht öffentlich gewertet. Auffällige Ergebnisse können geprüft und nachträglich aus Rankings entfernt werden.", Icon: ShieldCheck },
      { title: "Kategorien und Einstellungen", text: "Alle angebotenen Kategorien und Schwierigkeitsstufen sowie die Einschränkung „Kein Bildzoom“ werden unterstützt. Öffentlich sichtbar wird eine Platzierung nur mit aktivem, öffentlichem Profil und öffentlichem Namen.", Icon: Gauge },
      { title: "Zeiträume und Kategorien", text: "Rankings lassen sich nach Tag, Woche, Monat, Jahr und nach verfügbaren Kategorien filtern.", Icon: Trophy }
    ]
  }
};

export function HelpTopicPage({ topic }: { topic: HelpTopic }) {
  const content = topicContent[topic];
  return (
    <InfoPageShell compact fillDesktop plainContent eyebrow={content.eyebrow} title={content.title} intro={content.intro}>
      <div className="grid gap-3 md:grid-cols-2">
        {content.sections.map((section) => (
          <section key={section.title} className="punktlandung-static-card rounded-xl border p-4">
            <h2 className="flex items-center gap-3 text-lg font-black text-white"><section.Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{section.text}</p>
            {section.href && section.hrefLabel && <Link href={section.href} className="mt-3 inline-block text-sm font-bold text-emerald-300 underline underline-offset-4">{section.hrefLabel}</Link>}
          </section>
        ))}
        <div className="flex justify-end md:col-span-2">
          <RedesignButtonLink href="/solo-modus" tone="primary" style={{ width: "fit-content" }}>Spielen</RedesignButtonLink>
        </div>
      </div>
    </InfoPageShell>
  );
}
