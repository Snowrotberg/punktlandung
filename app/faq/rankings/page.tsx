import type { Metadata } from "next";
import { HelpTopicPage } from "@/components/HelpTopicPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung Konto, Spielverlauf und Rankings erklärt",
  description: "Ohne Anmeldung spielen, Partien im Konto speichern und nachvollziehen, welche Ergebnisse bei Punktlandung öffentlich gewertet werden.",
  alternates: { canonical: absoluteUrl("/faq/rankings") }
};

export default function Page() { return <HelpTopicPage topic="rankings" />; }
