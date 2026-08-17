"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./InlineInfoPopover.module.css";

type InlineInfoPopoverProps = {
  ariaLabel: string;
  className?: string;
  align?: "center" | "right";
  title: string;
  children: React.ReactNode;
  href?: string;
  hrefLabel?: string;
};

export function InlineInfoPopover({ ariaLabel, className, align = "center", title, children, href, hrefLabel }: InlineInfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span className={`${styles.root} ${align === "right" ? styles.alignRight : ""} ${className ?? ""}`} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <span className={styles.panel} id={panelId} role="dialog" aria-label={title}>
          <span className={styles.heading}>
            <strong>{title}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Hinweis schließen">
              <X aria-hidden="true" size={13} strokeWidth={2.5} />
            </button>
          </span>
          <span className={styles.copy}>{children}</span>
          {href && hrefLabel && <Link href={href} className={styles.link}>{hrefLabel}</Link>}
        </span>
      )}
    </span>
  );
}
