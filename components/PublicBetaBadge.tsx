import Link from "next/link";

type PublicBetaBadgeProps = {
  compact?: boolean;
  className?: string;
};

export function PublicBetaBadge({ compact = false, className = "" }: PublicBetaBadgeProps) {
  return (
    <Link
      href="/feedback"
      className={`punktlandung-beta-badge ${compact ? "punktlandung-beta-badge--compact" : ""} ${className}`.trim()}
      aria-label="Punktlandung Web-Version"
      title="Punktlandung im Browser"
    >
      <span className="punktlandung-beta-badge-dot" aria-hidden="true" />
      <span className="punktlandung-beta-badge-label">Web-Version</span>
    </Link>
  );
}
