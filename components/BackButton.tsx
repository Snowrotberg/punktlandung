"use client";

import type { ButtonHTMLAttributes } from "react";
import type { AnchorHTMLAttributes } from "react";
import { Button, ButtonLink } from "./Button";
import { TriangleIcon } from "./TriangleIcon";

type BackButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label?: string;
  sound?: "none" | "click" | "select";
};

export function BackButton({ label = "Zurueck", sound = "click", className = "", ...props }: BackButtonProps) {
  return (
    <Button
      {...props}
      aria-label={props["aria-label"] ?? label}
      title={props.title ?? label}
      sound={sound}
      tone="ghost"
      className={`punktlandung-back-button ${className}`}
    >
      <TriangleIcon direction="left" className="h-5 w-5" />
    </Button>
  );
}

type BackLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href" | "onClick"> & {
  href: string;
  label?: string;
  sound?: "none" | "click" | "select";
  onNavigate?: () => void;
};

export function BackLink({ href, label = "Zurueck", sound = "click", className = "", onNavigate, ...props }: BackLinkProps) {
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
      <TriangleIcon direction="left" className="h-5 w-5" />
    </ButtonLink>
  );
}
