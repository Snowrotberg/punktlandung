import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/SeoLandingPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Geografie-Spiel online - kostenlos Orte und Laender erraten",
  description:
    "Punktlandung ist ein kostenloses Geografie-Spiel im Browser mit Karten-Tipps, Punkten nach Entfernung und Kategorien wie Staedte, Flaggen und Wahrzeichen.",
  alternates: {
    canonical: absoluteUrl("/geografie-spiel")
  }
};

export default function GeografieSpielPage() {
  return (
    <SeoLandingPage
      eyebrow="Online-Geografie-Quiz"
      title="Geografie-Spiel online spielen"
      intro="In Punktlandung trainierst du dein Gefuehl fuer Orte, Laender und Entfernungen. Du siehst einen Hinweis, setzt deinen Tipp auf der Karte und vergleichst dein Ergebnis mit dem Zielort."
      sections={[
        {
          title: "Karte statt Multiple Choice",
          body: "Du klickst nicht nur eine Antwort an, sondern setzt deinen Pin selbst. Dadurch zaehlt dein raeumliches Gefuehl."
        },
        {
          title: "Viele Kategorien",
          body: "Wahrzeichen, Staedte, Landschaften, Flaggen und Hauptstaedte bringen unterschiedliche Arten von Geografie-Wissen ins Spiel."
        },
        {
          title: "Allein oder gemeinsam",
          body: "Punktlandung funktioniert als kurze Solo-Runde und als gemeinsames Geografie-Spiel fuer Gruppen."
        }
      ]}
    />
  );
}

