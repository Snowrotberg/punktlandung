import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode
} from "react";
import { playerColorAt } from "@/lib/playerPalette";
import styles from "./RedesignPrimitives.module.css";

function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

type RootProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function RedesignRoot({ className, children, ...props }: RootProps) {
  return (
    <div className={classNames(styles.root, className)} {...props}>
      {children}
    </div>
  );
}
export function RedesignShell({ className, children, ...props }: RootProps) {
  return (
    <div className={classNames(styles.root, styles.shell, className)} {...props}>
      {children}
    </div>
  );
}

export function RedesignHeader({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <header className={classNames(styles.header, className)} {...props}>
      {children}
    </header>
  );
}

export function RedesignFooter({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <footer className={classNames(styles.footer, className)} {...props}>
      {children}
    </footer>
  );
}

type SurfaceTone = "default" | "soft" | "strong";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  tone?: SurfaceTone;
  padded?: boolean;
};

export function Surface({ tone = "default", padded = true, className, ...props }: SurfaceProps) {
  return (
    <div
      className={classNames(
        styles.surface,
        tone === "soft" && styles.surfaceSoft,
        tone === "strong" && styles.surfaceStrong,
        padded && styles.padded,
        className
      )}
      {...props}
    />
  );
}

export type RedesignButtonTone = "primary" | "secondary" | "quiet" | "text";

type RedesignButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: RedesignButtonTone;
};

const buttonToneClass: Record<RedesignButtonTone, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  quiet: styles.quiet,
  text: styles.textButton
};

export function RedesignButton({ tone = "secondary", className, type = "button", ...props }: RedesignButtonProps) {
  return <button type={type} className={classNames(styles.button, buttonToneClass[tone], className)} {...props} />;
}

type RedesignButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  tone?: RedesignButtonTone;
};

export function RedesignButtonLink({ tone = "secondary", className, ...props }: RedesignButtonLinkProps) {
  return <a className={classNames(styles.button, buttonToneClass[tone], className)} {...props} />;
}

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

type SegmentGroupProps<T extends string> = {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentGroup<T extends string>({ ariaLabel, value, options, onChange, className }: SegmentGroupProps<T>) {
  return (
    <fieldset
      aria-label={ariaLabel}
      className={classNames(styles.segmentGroup, className)}
      style={{ "--pl-segment-count": options.length } as CSSProperties}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={classNames(styles.segment, selected && styles.segmentSelected)}
            aria-pressed={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}

type PlayerAvatarProps = HTMLAttributes<HTMLSpanElement> & {
  name: string;
  playerIndex?: number;
  color?: string;
  size?: string;
};

export function PlayerAvatar({ name, playerIndex = 0, color, size, className, style, ...props }: PlayerAvatarProps) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase("de-DE") ?? "?";
  return (
    <span
      aria-label={name}
      className={classNames(styles.avatar, className)}
      style={
        {
          "--pl-player-color": color ?? playerColorAt(playerIndex),
          "--pl-avatar-size": size,
          ...style
        } as CSSProperties
      }
      {...props}
    >
      {initial}
    </span>
  );
}

type ScoreBarProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  value: number;
  max: number;
  label: string;
  height?: string;
};

export function ScoreBar({ value, max, label, height, className, style, ...props }: ScoreBarProps) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="img"
      aria-label={`${label}: ${Math.round(percentage)} Prozent`}
      className={classNames(styles.scoreBar, className)}
      style={{ "--pl-score-height": height, ...style } as CSSProperties}
      {...props}
    >
      <span className={styles.scoreFill} style={{ "--pl-score": `${percentage}%` } as CSSProperties} />
    </div>
  );
}

type AdFrameProps = HTMLAttributes<HTMLElement> & {
  variant?: "inline" | "rail" | "game";
  label?: string;
};

export function RedesignAdFrame({ variant = "inline", label = "Anzeige", className, children, ...props }: AdFrameProps) {
  return (
    <aside
      aria-label={label}
      className={classNames(styles.adFrame, variant === "rail" && styles.adRail, className)}
      {...props}
    >
      {children ?? label}
    </aside>
  );
}
