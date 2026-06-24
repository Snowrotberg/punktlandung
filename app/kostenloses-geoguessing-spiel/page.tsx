import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/SeoLandingPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Kostenloses GeoGuessing-Spiel - Punktlandung online spielen",
  description:
    "Spiele Punktlandung kostenlos im Browser: ein GeoGuessing-Spiel mit Solo-Modus, Party-Modus und Kategorien fuer Orte, Flaggen, Staedte und Wahrzeichen.",
  alternates: {
    canonical: absoluteUrl("/kostenloses-geoguessing-spiel")
  }
};

export default function KostenlosesGeoGuessingSpielPage() {
  return (
    <SeoLandingPage
      eyebrow="Kostenloses Browser-Spiel"
      title="Kostenloses GeoGuessing-Spiel"
      intro="Punktlandung ist ein kostenloses GeoGuessing-Spiel fuer den Browser. Du brauchst keine Installation, sondern kannst direkt eine Runde starten und dein Geografie-Gefuehl testen."
      sections={[
        {
          title: "Ohne Installation",
          body: "Punktlandung laeuft im Browser und ist fuer schnelle Spielrunden vorbereitet."
        },
        {
          title: "Kostenlos starten",
          body: "Der Einstieg ist kostenlos. Solo- und Party-Runden koennen ohne Kauf gestartet werden."
        },
        {
          title: "Deutschsprachig",
          body: "Die Oberflaeche ist auf Deutsch, damit die Regeln auch in gemischten Gruppen sofort klar sind."
        }
      ]}
    />
  );
}

