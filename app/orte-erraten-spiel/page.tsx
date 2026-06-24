import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/SeoLandingPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Orte erraten Spiel - Standort auf der Karte tippen",
  description:
    "Beim Orte-erraten-Spiel Punktlandung siehst du ein Bild oder eine Aufgabe, setzt einen Pin auf der Karte und bekommst Punkte nach Entfernung.",
  alternates: {
    canonical: absoluteUrl("/orte-erraten-spiel")
  }
};

export default function OrteErratenSpielPage() {
  return (
    <SeoLandingPage
      eyebrow="Pin setzen und Punkte sammeln"
      title="Orte erraten im Browser"
      intro="Punktlandung ist ein Orte-erraten-Spiel fuer alle, die Bilder, Staedte, Landschaften und Wahrzeichen gern auf einer Karte einordnen. Je genauer dein Tipp ist, desto besser faellt die Runde aus."
      sections={[
        {
          title: "Bild ansehen",
          body: "Jede Runde zeigt dir einen Ort oder eine Geografie-Aufgabe. Du entscheidest, welcher Punkt auf der Karte passt."
        },
        {
          title: "Entfernung sehen",
          body: "Nach deinem Tipp zeigt Punktlandung, wie weit du vom richtigen Ort entfernt warst."
        },
        {
          title: "Runden vergleichen",
          body: "Im Party-Modus sieht die Gruppe, wer am naechsten dran war und wer die meisten Punkte gesammelt hat."
        }
      ]}
    />
  );
}

