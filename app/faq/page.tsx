import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";
import { absoluteUrl } from "@/lib/seo";
import Link from "next/link";
import { BookOpenText, CircleUserRound, Images, ListChecks, Users } from "lucide-react";
import { FaqCards } from "@/components/SeoContent";
import { FaqStructuredData } from "@/components/StructuredData";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Hilfe & Infos zu Punktlandung – Spiel, Konto und Aufgaben",
  description:
    "Hilfe und Informationen zu Punktlandung: Spielablauf, Punkte, Konto, Rankings, Orte, Quellen und gemeinsame Partien verständlich erklärt.",
  alternates: {
    canonical: absoluteUrl("/faq")
  }
};

const topicLinks = [
  ["/so-funktioniert-punktlandung", "Spielen & Punkte", "Partie starten, Tipp setzen, Auflösung verstehen und die Punkteberechnung nachvollziehen.", ListChecks],
  ["/faq/rankings", "Konto & Rankings", "Ohne Anmeldung spielen, Partien speichern und öffentliche Platzierungen verstehen.", CircleUserRound],
  ["/ortskatalog", "Orte & Quellen", "Kategorien, Länderabdeckung, Katalogumfang sowie Bildquellen und Lizenzen ansehen.", Images],
  ["/partyspiel-geografie", "Mit Freunden spielen", "Party-Modus und Online-Raum passend für eure gemeinsame Runde einrichten.", Users]
] as const;

export default function FaqPage() {
  return (
    <>
      <FaqStructuredData />
      <InfoPageShell
        fillDesktop
        plainContent
        eyebrow="Hilfe & Infos"
        title="Was möchtest du über Punktlandung wissen?"
        intro="Finde Spielregeln, Konto- und Rankinghinweise, Informationen zu Orten und Quellen sowie Tipps für gemeinsame Partien an einem Ort."
      >
        <div className={styles.content}>
        <div className="grid gap-3 md:grid-cols-2">
          {topicLinks.map(([href, title, text, Icon]) => (
            <Link key={href} href={href} className="punktlandung-help-card rounded-xl border p-4 no-underline transition hover:border-emerald-300/70">
              <h2 className="flex items-center gap-3 text-lg font-black text-white"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
              <i className="punktlandung-card-arrow" aria-hidden="true">›</i>
            </Link>
          ))}
        </div>

        <section aria-labelledby="about-punktlandung-heading">
          <Link href="/infos" className="punktlandung-help-card rounded-xl border p-4 no-underline">
            <h2 id="about-punktlandung-heading" className="flex items-center gap-3 text-lg font-black text-white"><BookOpenText aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />Über Punktlandung</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Erfahre mehr über die Spielidee, die Web-Version, die Pflege der Inhalte und die Finanzierung des Projekts.</p>
            <i className="punktlandung-card-arrow" aria-hidden="true">›</i>
          </Link>
        </section>

        <section className={styles.quickAnswers} aria-labelledby="quick-answers-heading">
          <h2 id="quick-answers-heading">Kurz beantwortet</h2>
          <FaqCards columns headingLevel="h3" />
        </section>
        </div>
      </InfoPageShell>
    </>
  );
}
