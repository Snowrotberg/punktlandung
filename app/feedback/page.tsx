import type { Metadata } from "next";
import { FeedbackForm } from "@/components/FeedbackForm";
import { ContributionPaths } from "@/components/ContributionPaths";
import { InfoPageShell } from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Feedback zu Punktlandung",
  description: "Feedback, Fehler und Verbesserungsvorschläge zu Punktlandung senden.",
  robots: {
    index: false,
    follow: false
  }
};

export default function FeedbackPage() {
  return (
    <InfoPageShell
      fillDesktop
      compact
      plainContent
      eyebrow="Punktlandung verbessern"
      title="Feedback zu Punktlandung"
      intro="Sag uns, was gut funktioniert, wo etwas hakt oder was du dir für Punktlandung wünschst."
    >
      <FeedbackForm context={{ source: "feedback-page" }} compact />
      <ContributionPaths mode="idea" />
    </InfoPageShell>
  );
}
