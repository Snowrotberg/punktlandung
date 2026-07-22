import type { Metadata } from "next";
import { FaqCards } from "@/components/SeoContent";
import { InfoPageShell } from "@/components/InfoPageShell";
import { FaqStructuredData } from "@/components/StructuredData";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung FAQ - Fragen zum kostenlosen Geo-Quiz",
  description:
    "Antworten zu Punktlandung: kostenlos spielen, ohne Anmeldung starten, Kategorien waehlen und als Geo-Quiz oder Partyspiel nutzen.",
  alternates: {
    canonical: absoluteUrl("/faq")
  }
};

export default function FaqPage() {
  return (
    <>
      <FaqStructuredData />
      <InfoPageShell
        eyebrow="Punktlandung spielen"
        title="Häufige Fragen zu Punktlandung"
        intro="Kurze Antworten zum kostenlosen Geo-Quiz, zu Kategorien, Party-Modus und Einstieg ohne Anmeldung."
      >
        <FaqCards />
      </InfoPageShell>
    </>
  );
}
