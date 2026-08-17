"use client";

import { useEffect, useState } from "react";
import styles from "./AccountRoundVisual.module.css";

export function AccountRoundImage({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const imageSrc = `/api/image?src=${encodeURIComponent(src)}&w=1600`;
  return <>
    <button type="button" className={styles.imageButton} onClick={() => setOpen(true)}>
      <img src={`/api/image?src=${encodeURIComponent(src)}&w=720`} alt={`Gespielte Aufgabe: ${title}`} loading="lazy" />
      <span>Bild maximieren</span>
    </button>
    {open && <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Bild zu ${title}`} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <div className={`${styles.modalPanel} ${styles.imagePanel}`}>
        <div className={styles.modalHeader}><strong>{title} · Aufgabenbild</strong><button type="button" onClick={() => setOpen(false)} aria-label="Bild schließen">×</button></div>
        <img src={imageSrc} alt={`Gespielte Aufgabe: ${title}`} />
      </div>
    </div>}
  </>;
}
