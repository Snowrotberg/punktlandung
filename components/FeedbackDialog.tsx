"use client";

import { useEffect, useId, useRef } from "react";
import type { FeedbackContext } from "@/types/feedback";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { FeedbackForm } from "./FeedbackForm";

type FeedbackDialogProps = {
  open: boolean;
  context: FeedbackContext;
  onClose: () => void;
  onSubmitted: () => void;
};

export function FeedbackDialog({ open, context, onClose, onSubmitted }: FeedbackDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    trackAnalyticsEvent("feedback_open", {
      source: context.source,
      game_mode: context.mode,
      category: context.category
    });
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')
      ).filter((element) => element.tabIndex >= 0 && !element.hasAttribute("aria-hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [context.category, context.mode, context.source, open]);

  if (!open) return null;

  return (
    <div className="punktlandung-feedback-dialog-layer fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/76 p-2 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="punktlandung-feedback-dialog arcade-panel relative max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-md border-emerald-300/40 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.58)] sm:max-h-[calc(100dvh-2rem)] sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="punktlandung-interactive-control absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md border border-slate-600/80 bg-slate-950/72 text-lg font-black text-slate-200 transition hover:border-emerald-300 hover:text-emerald-200"
          aria-label="Feedback-Fenster schließen"
          title="Schließen"
        >
          ×
        </button>

        <div className="pr-12">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">Öffentliche Beta</p>
          <h2 id={titleId} className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">Wie war deine Partie?</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-300">Dein freiwilliges Feedback hilft uns, Fehler zu finden und Punktlandung weiterzuentwickeln.</p>
        </div>

        <FeedbackForm context={context} onSubmitted={onSubmitted} className="mt-5" />

        <button type="button" onClick={onClose} className="punktlandung-interactive-control mt-3 w-full rounded-md border border-slate-600/80 bg-slate-950/42 px-4 py-2.5 text-sm font-black text-slate-300 transition hover:border-slate-400 hover:text-white">
          Später
        </button>
      </section>
    </div>
  );
}
