"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProfileVisibilitySelect.module.css";

type Visibility = "public" | "private";
const options: Array<{ value: Visibility; label: string }> = [
  { value: "public", label: "Öffentlich in Rankings & Community" },
  { value: "private", label: "Privat – ohne öffentlichen Namen" }
];

export function ProfileVisibilitySelect({ defaultValue }: { defaultValue: Visibility }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const menuId = "profile-visibility-options";

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <input id="visibility" type="hidden" name="visibility" value={value} />
      <button type="button" className={styles.trigger} aria-haspopup="listbox" aria-controls={menuId} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{selected.label}</span><span className={styles.chevron} aria-hidden="true" />
      </button>
      {open && <div id={menuId} className={styles.menu} role="listbox" aria-label="Profil-Sichtbarkeit">
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={value === option.value} className={value === option.value ? styles.optionSelected : styles.option} onClick={() => { setValue(option.value); setOpen(false); }}>{option.label}</button>)}
      </div>}
    </div>
  );
}
