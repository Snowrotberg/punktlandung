import type { Metadata } from "next";
import { HelpTopicPage } from "@/components/HelpTopicPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung Punkte - Entfernung und Wertung erklärt",
  description: "Wie die Punkte bei Punktlandung berechnet werden: Entfernung zum Ziel, bis zu 5.000 Punkte und Tippzeit bei Gleichstand.",
  alternates: { canonical: absoluteUrl("/faq/punkte") }
};

export default function Page() { return <HelpTopicPage topic="punkte" />; }
