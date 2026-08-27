import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";
import { absoluteUrl } from "@/lib/seo";
import Link from "next/link";
import { ContributionPaths } from "@/components/ContributionPaths";
import { CircleUserRound, ListChecks, Target, Trophy } from "lucide-react";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Punktlandung FAQ - Fragen zum kostenlosen Geo-Quiz",
  description:
    "Antworten zu Punktlandung: kostenlos spielen, ohne Anmeldung starten, Kategorien wählen und als Geo-Quiz oder Partyspiel nutzen.",
  alternates: {
    canonical: absoluteUrl("/faq")
  }
};

const faqLinks = [
  ["/faq/spielablauf", "Spielablauf", "Partie einstellen, Aufgabe erkennen, Tipp setzen und Auflösung ansehen.", ListChecks],
  ["/faq/punkte", "Punkte", "Entfernungswertung, 5.000-Punkte-Treffer und Gesamtpunktzahl.", Target],
  ["/faq/konten", "Konten", "Freiwillige Anmeldung, automatische Speicherung und private Profile.", CircleUserRound],
  ["/faq/rankings", "Rankings", "Welche Ergebnisse öffentlich zählen und wie faire Vergleiche entstehen.", Trophy]
] as const;

export default function FaqPage() {
  return (
      <InfoPageShell
        compact
        fillDesktop
        plainContent
        eyebrow="Hilfe · Übersicht"
        title="Häufige Fragen zu Punktlandung"
        intro="Schnelle Hilfe zu Spielablauf, Punkten, Konten und Rankings – ohne lange nach der passenden Antwort zu suchen."
      >
        <div className={styles.content}>
        <div className="grid gap-3 md:grid-cols-2">
          {faqLinks.map(([href, title, text, Icon]) => (
            <Link key={href} href={href} className="punktlandung-help-card rounded-xl border p-4 no-underline transition hover:border-emerald-300/70">
              <h2 className="flex items-center gap-3 text-lg font-black text-white"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
              <i className="punktlandung-card-arrow" aria-hidden="true">›</i>
            </Link>
          ))}
        </div>
        <section className="punktlandung-static-card rounded-xl border p-4">
          <h2 className="text-lg font-black text-white">Schnelle Hilfe oder ausführliche Infos?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Die Hilfethemen oben beantworten konkrete Fragen beim Spielen. Unter Infos findest du ausführliche Hintergründe zum Spielprinzip, zu Spielarten und zum Aufgabenkatalog.
          </p>
          <Link href="/infos" className="mt-3 inline-block text-sm font-bold text-emerald-300 underline underline-offset-4">
            Zu den Infos über Punktlandung
          </Link>
        </section>
        <ContributionPaths mode="both" />
        </div>
      </InfoPageShell>
  );
}
