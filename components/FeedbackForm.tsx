"use client";

import { useRef, useState, type FormEvent } from "react";
import type { FeedbackContext, FeedbackPayload } from "@/types/feedback";
import { trackAnalyticsEvent } from "@/lib/analytics";

type FeedbackFormProps = {
  context: FeedbackContext;
  onSubmitted?: () => void;
  autoFocus?: boolean;
  className?: string;
  compact?: boolean;
};

type SubmitState = "idle" | "sending" | "sent" | "error";

export function FeedbackForm({ context, onSubmitted, autoFocus = false, className = "", compact = false }: FeedbackFormProps) {
  const openedAt = useRef(Date.now());
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitState === "sending") return;

    setSubmitState("sending");
    setErrorMessage("");

    const payload: FeedbackPayload = {
      ...context,
      message: message.trim(),
      email: email.trim() || undefined,
      website,
      openedAt: openedAt.current
    };

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Das Feedback konnte gerade nicht gesendet werden.");
      }

      setSubmitState("sent");
      setMessage("");
      setEmail("");
      trackAnalyticsEvent("feedback_submit", {
        source: context.source,
        game_mode: context.mode,
        category: context.category
      });
      onSubmitted?.();
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(error instanceof Error ? error.message : "Das Feedback konnte gerade nicht gesendet werden.");
    }
  };

  if (submitState === "sent") {
    return (
      <div className={`punktlandung-feedback-success rounded-md border border-emerald-300/45 bg-emerald-400/10 p-5 ${className}`} role="status">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Vielen Dank</p>
        <h2 className="mt-2 text-2xl font-black text-white">Dein Feedback ist angekommen.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Damit hilfst du, Punktlandung gezielt weiterzuentwickeln.</p>
      </div>
    );
  }

  return (
    <form className={`punktlandung-feedback-form grid ${compact ? "gap-2.5 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)] lg:items-start" : "gap-4"} ${className}`} onSubmit={submitFeedback}>
      <div className={compact ? "lg:row-span-4" : ""}>
        <textarea
          id="feedback-message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          minLength={10}
          maxLength={4000}
          rows={compact ? 6 : 6}
          required
          autoFocus={autoFocus}
          placeholder="Deine Nachricht …"
          className={`punktlandung-feedback-field w-full resize-y rounded-md px-3.5 py-3 text-base leading-6 outline-none transition ${compact ? "min-h-40 lg:min-h-56" : "min-h-32"}`}
        />
        <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">{message.length}/4000</p>
      </div>

      <div className={compact ? "lg:ml-3" : ""}>
        <label htmlFor="feedback-email" className="block text-xs font-black uppercase tracking-[0.2em] text-indigo-300">
          E-Mail für Rückfragen <span className="normal-case tracking-normal text-slate-500">(optional)</span>
        </label>
        <input
          id="feedback-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          placeholder="name@beispiel.de"
          className="punktlandung-feedback-field mt-2 w-full rounded-md px-3.5 py-3 text-base outline-none transition"
        />
      </div>

      <div className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="feedback-website">Website</label>
        <input id="feedback-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>

      <p className={`text-xs leading-5 text-slate-400 ${compact ? "lg:ml-3 lg:mt-3 lg:self-start" : ""}`}>
        Deine Nachricht wird per E-Mail an das Punktlandung-Team übermittelt. Eine E-Mail-Adresse ist freiwillig und wird nur für Rückfragen verwendet. Weitere Hinweise findest du im{" "}
        <a href="/datenschutz" className="font-bold text-emerald-300 underline-offset-4 hover:underline focus-visible:underline">Datenschutz</a>.
      </p>

      {submitState === "error" && (
        <p className="rounded-md border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={submitState === "sending" || message.trim().length < 10}
        className={`punktlandung-interactive-control relative min-h-12 overflow-hidden rounded-md border-2 border-emerald-400/80 bg-slate-950/72 px-5 py-3 text-sm font-black text-emerald-100 shadow-good transition before:absolute before:left-0 before:top-1/2 before:h-7 before:w-1.5 before:-translate-y-1/2 before:rounded-r-full before:bg-emerald-300/80 hover:border-emerald-300 hover:bg-slate-900/86 disabled:cursor-not-allowed disabled:opacity-45 ${compact ? "lg:ml-3 lg:self-end" : ""}`}
      >
        <span className="relative">{submitState === "sending" ? "Wird gesendet …" : "Feedback senden"}</span>
      </button>
    </form>
  );
}
