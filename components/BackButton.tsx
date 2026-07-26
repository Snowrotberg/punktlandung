"use client";

import type { ButtonHTMLAttributes } from "react";
import type { AnchorHTMLAttributes } from "react";
import { Button, ButtonLink } from "./Button";
import { TriangleIcon } from "./TriangleIcon";

type BackButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label?: string;
  sound?: "none" | "click" | "select";
};

export function BackControlContent() {
  return (
    <span className="punktlandung-back-control-content" aria-hidden="true">
      <TriangleIcon direction="left" className="punktlandung-back-control-icon h-4 w-4" />
      <span className="punktlandung-back-control-label">Zurück</span>
    </span>
  );
}

export function BackButton({ label = "Zurück", sound = "click", className = "", ...props }: BackButtonProps) {
  return (
    <Button
      {...props}
      aria-label={props["aria-label"] ?? label}
      title={props.title ?? label}
      sound={sound}
      tone="ghost"
      className={`punktlandung-back-button ${className}`}
    >
      <BackControlContent />
    </Button>
  );
}

type BackLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href" | "onClick"> & {
  href: string;
  label?: string;
  sound?: "none" | "click" | "select";
  onNavigate?: () => void;
};

export function BackLink({ href, label = "Zurück", sound = "click", className = "", onNavigate, ...props }: BackLinkProps) {
  return (
    <ButtonLink
      {...props}
      href={href}
      aria-label={props["aria-label"] ?? label}
      title={props.title ?? label}
      sound={sound}
      tone="ghost"
      onNavigate={onNavigate}
      className={`punktlandung-back-button ${className}`}
    >
      <BackControlContent />
    </ButtonLink>
  );
}
