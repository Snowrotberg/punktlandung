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
  const { title, ...buttonProps } = props;
  return (
    <Button
      {...buttonProps}
      aria-label={buttonProps["aria-label"] ?? label}
      data-tooltip={title ?? label}
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
  const { title, ...linkProps } = props;
  return (
    <ButtonLink
      {...linkProps}
      href={href}
      aria-label={linkProps["aria-label"] ?? label}
      data-tooltip={title ?? label}
      sound={sound}
      tone="ghost"
      onNavigate={onNavigate}
      className={`punktlandung-back-button ${className}`}
    >
      <BackControlContent />
    </ButtonLink>
  );
}
