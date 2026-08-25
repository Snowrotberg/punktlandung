import type { Metadata } from "next";
import { HelpTopicPage } from "@/components/HelpTopicPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung Rankings - gewertete Partien erklärt",
  description: "Welche Partien bei Punktlandung in öffentlichen Rankings zählen und wie Zeitlimit, Profil und technische Prüfung zusammenspielen.",
  alternates: { canonical: absoluteUrl("/faq/rankings") }
};

export default function Page() { return <HelpTopicPage topic="rankings" />; }
