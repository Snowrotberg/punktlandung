import type { Metadata } from "next";
import { HelpTopicPage } from "@/components/HelpTopicPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung Konto - Spielen und Spielstände speichern",
  description: "Punktlandung funktioniert ohne Anmeldung. Erfahre, wann ein Konto nötig ist und wie abgeschlossene Partien gespeichert werden.",
  alternates: { canonical: absoluteUrl("/faq/konten") }
};

export default function Page() { return <HelpTopicPage topic="konten" />; }
