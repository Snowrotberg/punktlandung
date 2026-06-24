import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/SeoLandingPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "GeoGuessr Alternative Deutsch - kostenlos im Browser spielen",
  description:
    "Punktlandung ist eine deutschsprachige GeoGuessr-Alternative fuer schnelle Geo-Quiz-Runden im Browser, allein oder als Partyspiel.",
  alternates: {
    canonical: absoluteUrl("/geoguessr-alternative-deutsch")
  }
};

export default function GeoGuessrAlternativeDeutschPage() {
  return (
    <SeoLandingPage
      eyebrow="Alternative fuer Geo-Quiz-Fans"
      title="GeoGuessr Alternative auf Deutsch"
      intro="Punktlandung bringt das Prinzip Orte erkennen und auf der Karte tippen in ein schnelles, deutschsprachiges Browser-Spiel. Du startest ohne Anmeldung und kannst allein oder mit mehreren Personen am selben Bildschirm spielen."
      sections={[
        {
          title: "Direkt spielbar",
          body: "Der Solo-Modus und der lokale Party-Modus sind fuer schnelle Runden gedacht. Namen eintragen, Kategorie waehlen und loslegen."
        },
        {
          title: "Deutsche Oberflaeche",
          body: "Menues, Hinweise und Kategorien sind auf Deutsch formuliert, damit neue Spieler ohne Erklaerung in die Runde finden."
        },
        {
          title: "Mehr als ein Ort",
          body: "Neben gemischten Orten gibt es Kategorien wie Staedte, Wahrzeichen, Landschaften, Flaggen und Hauptstaedte."
        }
      ]}
    />
  );
}

