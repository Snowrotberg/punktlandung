import { InfoPageShell } from "@/components/InfoPageShell";
import { AccountFlowDiagram } from "@/components/EditorialExplainers";
import { RedesignButtonLink } from "@/components/redesign";
import { CircleUserRound, Gauge, History, ShieldCheck, Target, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import styles from "./HelpTopicPage.module.css";
import { HelpBackLink } from "./HelpBackLink";

export type HelpTopic = "rankings";

const topicContent: Record<HelpTopic, {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ id?: string; title: string; text: string; Icon: LucideIcon; href?: string; hrefLabel?: string }>;
}> = {
  rankings: {
    eyebrow: "Hilfe & Infos · Konto & Rankings",
    title: "Konto, Spielverlauf und Rankings",
    intro: "Du kannst ohne Anmeldung spielen. Ein Konto speichert abgeschlossene Partien dauerhaft; für eine öffentliche Platzierung gelten zusätzliche, nachvollziehbare Bedingungen.",
    sections: [
      { id: "konto-verlauf", title: "Spielen mit oder ohne Konto", text: "Gastpartien starten direkt. Meldest du dich an, werden vollständig abgeschlossene Partien deinem privaten Spielverlauf zugeordnet; eine abgeschlossene Gastpartie kannst du nachträglich übernehmen.", Icon: CircleUserRound },
      { title: "Gespeichert ist nicht automatisch öffentlich", text: "Der persönliche Verlauf enthält deine gespeicherten Partien. In Rankings erscheint nur ein Ergebnis, das zusätzlich alle öffentlichen Rankingbedingungen erfüllt.", Icon: History },
      { title: "Welche Partien öffentlich zählen", text: "Gewertet werden vollständig abgeschlossene und technisch geprüfte Partien mit 15, 30 oder 60 Sekunden Zeitlimit. Freie Rundenzeit zählt nicht öffentlich. Sichtbar wirst du nur mit aktivem öffentlichem Profil und öffentlichem Namen.", Icon: ShieldCheck },
      { title: "Warum fehlt eine gespeicherte Partie?", text: "Eine Partie kann im persönlichen Verlauf stehen, ohne für Rankings freigegeben zu sein – etwa bei freier Rundenzeit, unvollständigem Abschluss oder ausstehender technischer Prüfung.", Icon: Gauge },
      { title: "So entsteht die Platzierung", text: "Je Zeitraum und Kategorie zählt dein bester gültiger Wert. Grundlage sind die durchschnittlichen Punkte pro Runde; Zeitlimit, Schwierigkeit und aktive Einschränkungen werden mit den auf der Rankingseite veröffentlichten Faktoren gewichtet.", Icon: Target, href: "/rankings#ranking-berechnung", hrefLabel: "Berechnung und aktuelle Faktoren ansehen" },
      { title: "Prüfung gegen Missbrauch", text: "Ergebnisse werden technisch geprüft. Auffällige Partien können überprüft und nachträglich aus öffentlichen Rankings entfernt werden. Die Kriterien bleiben bewusst allgemein, damit die Prüfung nicht umgangen werden kann.", Icon: Trophy }
    ]
  }
};

export function HelpTopicPage({ topic }: { topic: HelpTopic }) {
  const content = topicContent[topic];
  return (
    <InfoPageShell fillDesktop plainContent eyebrow={content.eyebrow} title={content.title} intro={content.intro}>
      <div className={styles.content}>
        <HelpBackLink />
        <AccountFlowDiagram />
        <div className={styles.cards}>
          {content.sections.map((section) => (
            <section key={section.title} id={section.id} className="punktlandung-static-card scroll-mt-24 rounded-xl border p-4">
              <h2 className="flex items-center gap-3 text-lg font-black text-white"><section.Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{section.text}</p>
              {section.href && section.hrefLabel && <Link href={section.href} className="mt-3 inline-block text-sm font-bold text-emerald-300 underline underline-offset-4">{section.hrefLabel}</Link>}
            </section>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <RedesignButtonLink href="/rankings" tone="secondary" style={{ width: "fit-content" }}>Rankings ansehen</RedesignButtonLink>
          <RedesignButtonLink href="/solo-modus" tone="primary" style={{ width: "fit-content" }}>Spielen</RedesignButtonLink>
        </div>
      </div>
    </InfoPageShell>
  );
}
