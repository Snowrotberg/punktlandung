import type { Metadata } from "next";
import { HelpTopicPage } from "@/components/HelpTopicPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung Spielablauf - Partie starten und Orte erraten",
  description: "So läuft eine Partie Punktlandung ab: Einstellungen wählen, Aufgabe ansehen, Tipp setzen und die Auflösung auswerten.",
  alternates: { canonical: absoluteUrl("/faq/spielablauf") }
};

export default function Page() { return <HelpTopicPage topic="spielablauf" />; }
