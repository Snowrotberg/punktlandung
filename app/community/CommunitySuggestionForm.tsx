"use client";

import { useMemo, useRef, useState } from "react";
import { relatedCommunitySuggestions } from "@/lib/community";
import { createCommunitySuggestion } from "./actions";
import styles from "./page.module.css";

type RelatedCandidate = {
  suggestionId: string;
  title: string;
  details: string;
  voteCount: number;
};

export function CommunitySuggestionForm({ candidates }: { candidates: RelatedCandidate[] }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; details?: string }>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);
  const related = useMemo(() => relatedCommunitySuggestions(`${title} ${details}`, candidates), [candidates, details, title]);

  return (
    <form
      action={createCommunitySuggestion}
      className={styles.suggestionForm}
      noValidate
      onSubmit={(event) => {
        const nextErrors: { title?: string; details?: string } = {};
        if (title.trim().length < 8) nextErrors.title = "Bitte gib deiner Idee einen Titel mit mindestens acht Zeichen.";
        if (details.trim().length < 20) nextErrors.details = "Bitte beschreibe deine Idee mit mindestens 20 Zeichen.";

        if (nextErrors.title || nextErrors.details) {
          event.preventDefault();
          setErrors(nextErrors);
          (nextErrors.title ? titleRef.current : detailsRef.current)?.focus();
          return;
        }

        setErrors({});
        if (!reviewed) {
          event.preventDefault();
          setReviewed(true);
        }
      }}
    >
      <label>
        <span>Kurzer Titel</span>
        <input ref={titleRef} name="title" value={title} onChange={(event) => { setTitle(event.target.value); setReviewed(false); setErrors((current) => ({ ...current, title: undefined })); }} minLength={8} maxLength={100} required placeholder="Worum geht es?" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "community-title-error" : undefined} />
        {errors.title && <span id="community-title-error" className={styles.fieldError} role="alert"><b aria-hidden="true">!</b>{errors.title}</span>}
      </label>
      <label>
        <span>Beschreibung</span>
        <textarea ref={detailsRef} name="details" value={details} onChange={(event) => { setDetails(event.target.value); setReviewed(false); setErrors((current) => ({ ...current, details: undefined })); }} minLength={20} maxLength={2000} required rows={4} placeholder="Was fehlt dir noch, damit Punktlandung dein Lieblings-Geo-Guessing-Spiel wird?" aria-invalid={Boolean(errors.details)} aria-describedby={errors.details ? "community-details-error" : undefined} />
        {errors.details && <span id="community-details-error" className={styles.fieldError} role="alert"><b aria-hidden="true">!</b>{errors.details}</span>}
      </label>
      {reviewed && (
        <aside className={styles.relatedIdeas} aria-live="polite">
          <span>Gibt es deine Idee schon?</span>
          {related.length ? <><p>Diese Vorschläge gehen in eine ähnliche Richtung. Ist deine Idee schon dabei, kannst du ihr direkt deine Stimme geben.</p><ul className={styles.relatedList}>{related.map((suggestion) => <li key={suggestion.suggestionId}><strong>{suggestion.title}</strong><small>{suggestion.voteCount} Stimmen</small></li>)}</ul></> : <p>Sieht neu aus – wir haben keinen passenden Vorschlag gefunden.</p>}
        </aside>
      )}
      <div className={styles.formFooter}>
        <small>{reviewed ? "Nichts Passendes dabei? Dann reich deine Idee ein." : "Wir schauen kurz, ob jemand etwas Ähnliches vorgeschlagen hat."}</small>
        <button type="submit">{reviewed ? "Idee einreichen" : "Ähnliche Ideen ansehen"}</button>
      </div>
    </form>
  );
}
