"use client";

import { CircleHelp, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  const [panelStyle, setPanelStyle] = useState<CSSProperties>();
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const placePanel = () => {
      if (window.innerWidth <= 576) {
        setPanelStyle(undefined);
        return;
      }
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(288, window.innerWidth - 32);
      const estimatedHeight = panelRef.current?.getBoundingClientRect().height ?? 150;
      const left = align === "right"
        ? Math.max(16, Math.min(window.innerWidth - width - 16, trigger.right - width))
        : Math.max(16, Math.min(window.innerWidth - width - 16, trigger.left + trigger.width / 2 - width / 2));
      const above = trigger.top - estimatedHeight - 8;
      const top = above >= 16 ? above : Math.min(window.innerHeight - estimatedHeight - 16, trigger.bottom + 8);
      setPanelStyle({ left, top: Math.max(16, top), width });
    };
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [align, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
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
        data-question-mark-trigger="true"
        onClick={() => setOpen((current) => !current)}
      >
        <CircleHelp className={styles.questionMark} aria-hidden="true" focusable="false" />
      </button>
      {open && createPortal(
        <span ref={panelRef} className={styles.panel} id={panelId} role="dialog" aria-label={title} style={panelStyle}>
          <span className={styles.heading}>
            <strong>{title}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Hinweis schließen">
              <X aria-hidden="true" size={13} strokeWidth={2.5} />
            </button>
          </span>
          <span className={styles.copy}>{children}</span>
          {href && hrefLabel && <Link href={href} className={styles.link}>{hrefLabel}</Link>}
        </span>,
        document.body
      )}
    </span>
  );
}
