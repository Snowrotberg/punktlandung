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
      aria-label="Öffentliche Beta: Feedback zu Punktlandung geben"
      title="Feedback zur öffentlichen Beta geben"
    >
      <span className="punktlandung-beta-badge-dot" aria-hidden="true" />
      <span className="punktlandung-beta-badge-label">Öffentliche Beta</span>
    </Link>
  );
}
