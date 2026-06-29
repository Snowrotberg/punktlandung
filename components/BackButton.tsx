"use client";

import type { ButtonHTMLAttributes } from "react";
import { BackIcon } from "./BackIcon";
import { Button } from "./Button";

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
      <BackIcon className="h-5 w-5" />
    </Button>
  );
}
