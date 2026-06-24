import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/SeoLandingPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Geografie-Partyspiel - kostenlos fuer Gruppen spielen",
  description:
    "Punktlandung ist ein Geografie-Partyspiel fuer Gruppen am selben Bildschirm: Spieler eintragen, Kategorie waehlen, Orte tippen und Punkte vergleichen.",
  alternates: {
    canonical: absoluteUrl("/partyspiel-geografie")
  }
};

export default function PartyspielGeografiePage() {
  return (
    <SeoLandingPage
      eyebrow="Geo-Quiz fuer Gruppen"
      title="Geografie-Partyspiel fuer gemeinsame Runden"
      intro="Punktlandung eignet sich fuer Spieleabende, Pausen, Unterrichtsnahe Quizrunden oder Sofarunden. Mehrere Personen spielen am selben Bildschirm und tippen nacheinander den vermuteten Ort."
      sections={[
        {
          title: "Schneller Einstieg",
          body: "Die Gruppe braucht keine Accounts. Ein Name reicht, dann kann die Runde am gemeinsamen Bildschirm starten."
        },
        {
          title: "Gemeinsames Raten",
          body: "Alle sehen denselben Hinweis, diskutieren oder tippen nacheinander und vergleichen danach die Entfernung zum Ziel."
        },
        {
          title: "Flexible Runden",
          body: "Kategorien und Rundenzahl lassen sich anpassen, damit kurze Quizpausen und laengere Spielabende funktionieren."
        }
      ]}
    />
  );
}

