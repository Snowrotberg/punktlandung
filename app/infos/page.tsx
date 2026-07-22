import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";
import { HomeSeoContent } from "@/components/SeoContent";
import { FaqStructuredData } from "@/components/StructuredData";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung Infos - Geo-Quiz, FAQ und wichtige Seiten",
  description:
    "Informationen zu Punktlandung: kostenloses Geo-Guessing-Spiel, FAQ, Kategorien und wichtige Seiten zum deutschsprachigen Geo-Quiz.",
  alternates: {
    canonical: absoluteUrl("/infos")
  }
};

export default function InfosPage() {
  return (
    <>
      <FaqStructuredData />
      <InfoPageShell
        fillDesktop
        eyebrow="Punktlandung Infos"
        title="Geo-Quiz, Spielmodi und häufige Fragen"
        intro="Alles Wichtige über Punktlandung sowie direkte Wege zu den vertiefenden Informationsseiten."
      >
        <HomeSeoContent />
      </InfoPageShell>
    </>
  );
}
