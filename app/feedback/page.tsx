import type { Metadata } from "next";
import { FeedbackForm } from "@/components/FeedbackForm";
import { InfoPageShell } from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Feedback zur öffentlichen Beta",
  description: "Feedback, Fehler und Verbesserungsvorschläge zur öffentlichen Beta von Punktlandung senden.",
  robots: {
    index: false,
    follow: false
  }
};

export default function FeedbackPage() {
  return (
    <InfoPageShell
      fillDesktop
      eyebrow="Punktlandung verbessern"
      title="Feedback zu Punktlandung"
      intro="Sag uns, was gut funktioniert, wo etwas hakt oder was du dir für Punktlandung wünschst."
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-md border border-emerald-300/25 bg-slate-950/34 p-4 sm:p-5">
          <h2 className="text-[22px] font-black leading-tight text-white">Deine Rückmeldung</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Du kannst uns jederzeit schreiben – auch ohne zuvor eine Partie beendet zu haben.</p>
          <FeedbackForm context={{ source: "feedback-page" }} className="mt-5" />
        </div>
      </div>
    </InfoPageShell>
  );
}
