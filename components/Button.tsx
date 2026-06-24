"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useSound } from "./SoundProvider";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "selected" | "good" | "bad" | "ghost";
  sound?: "none" | "click" | "select";
  newTabHref?: string | (() => string | null | undefined) | false;
  children: ReactNode;
};

const toneClass = {
  primary: "heavy-button text-white",
  selected:
    "relative overflow-hidden border-emerald-400/80 bg-slate-950/72 text-emerald-100 shadow-good hover:border-emerald-300/90 hover:bg-slate-900/86 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-emerald-300/80",
  good: "border-emerald-400/80 bg-slate-950/55 text-emerald-100 shadow-good hover:bg-emerald-400/12",
  bad: "border-rose-500/80 bg-slate-950/55 text-rose-100 shadow-bad hover:bg-rose-500/12",
  ghost: "border-slate-600/80 bg-slate-950/45 text-slate-100 hover:border-slate-400/90 hover:bg-slate-800/70"
};

function resolveNewTabHref(target: ButtonProps["newTabHref"]): string | null {
  if (target === false) return null;
  if (typeof target === "function") return target() ?? null;
  if (typeof target === "string") return target;
  if (typeof window === "undefined") return null;
  return window.location.href;
}

function shouldOpenNewTab(event: MouseEvent<HTMLButtonElement>): boolean {
  return event.button === 1 || ((event.ctrlKey || event.metaKey) && event.button === 0);
}

function openNewTab(event: MouseEvent<HTMLButtonElement>, target: ButtonProps["newTabHref"], disabled?: boolean): boolean {
  if (disabled || !shouldOpenNewTab(event)) return false;
  const href = resolveNewTabHref(target);
  if (!href) return false;
  event.preventDefault();
  event.stopPropagation();
  const opened = window.open(href, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
  return true;
}

export function Button({ tone = "primary", sound = "none", className = "", children, newTabHref, ...props }: ButtonProps) {
  const casingClass = className.includes("normal-case") ? "" : "uppercase";
  const { playClick, playSelect } = useSound();
  const { onClick, onAuxClick, disabled, ...buttonProps } = props;

  return (
    <button
      className={`rounded-md border-3 px-4 py-3 text-sm font-black ${casingClass} tracking-wide transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 ${toneClass[tone]} ${className}`}
      disabled={disabled}
      data-punktlandung-new-tab-component="true"
      onClick={(event) => {
        if (openNewTab(event, newTabHref, disabled)) return;
        if (!disabled && sound === "click") playClick();
        if (!disabled && sound === "select") playSelect();
        onClick?.(event);
      }}
      onAuxClick={(event) => {
        if (openNewTab(event, newTabHref, disabled)) return;
        onAuxClick?.(event);
      }}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
