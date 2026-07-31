"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useSound } from "./SoundProvider";

export type ButtonTone = "primary" | "selected" | "good" | "bad" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  sound?: "none" | "click" | "select";
  children: ReactNode;
};

type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & {
  href: string;
  tone?: ButtonTone;
  sound?: "none" | "click" | "select";
  onNavigate?: () => void;
  children: ReactNode;
};

const toneClass = {
  primary: "heavy-button text-white",
  selected:
    "relative overflow-hidden border-emerald-400/80 bg-slate-950/72 text-emerald-100 shadow-[inset_0_0_18px_rgba(52,211,153,0.10)] hover:border-emerald-300/90 hover:bg-slate-900/86 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-emerald-300/80",
  good: "border-emerald-400/80 bg-slate-950/55 text-emerald-100 shadow-[inset_0_0_18px_rgba(52,211,153,0.10)] hover:bg-emerald-400/12",
  bad: "border-rose-500/80 bg-slate-950/55 text-rose-100 shadow-[inset_0_0_18px_rgba(244,63,94,0.10)] hover:bg-rose-500/12",
  ghost: "border-slate-600/80 bg-slate-950/45 text-slate-100 hover:border-slate-400/90 hover:bg-slate-800/70"
};

export function buttonClassName(tone: ButtonTone, className: string): string {
  const casingClass = className.includes("normal-case") ? "" : "uppercase";
  return `punktlandung-interactive-control rounded-md border-3 px-4 py-3 text-sm font-black ${casingClass} tracking-wide transition ${toneClass[tone]} ${className}`;
}

function isUnmodifiedPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function Button({ tone = "primary", sound = "none", className = "", children, ...props }: ButtonProps) {
  const { playClick, playSelect } = useSound();
  const { onClick, onAuxClick, disabled, ...buttonProps } = props;

  return (
    <button
      className={`${buttonClassName(tone, className)} disabled:cursor-not-allowed disabled:opacity-45`}
      disabled={disabled}
      onClick={(event) => {
        if (!disabled && sound === "click") playClick();
        if (!disabled && sound === "select") playSelect();
        onClick?.(event);
      }}
      onAuxClick={onAuxClick}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function ButtonLink({ href, tone = "primary", sound = "none", className = "", onNavigate, children, ...props }: ButtonLinkProps) {
  const { playClick, playSelect } = useSound();

  return (
    <a
      href={href}
      className={buttonClassName(tone, className)}
      onClick={(event) => {
        if (!isUnmodifiedPrimaryClick(event)) return;
        if (sound === "click") playClick();
        if (sound === "select") playSelect();
        if (!onNavigate) return;
        event.preventDefault();
        onNavigate();
      }}
      {...props}
    >
      {children}
    </a>
  );
}
