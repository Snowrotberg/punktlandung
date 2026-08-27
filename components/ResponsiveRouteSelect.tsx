import Link from "next/link";
import styles from "./ResponsiveRouteSelect.module.css";

export type ResponsiveRouteSelectOption = { href: string; label: string; value: string };

export function ResponsiveRouteSelect({ label, options, value }: { label: string; options: readonly ResponsiveRouteSelectOption[]; value: string }) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  return <details className={styles.select} name="responsive-route-select">
    <summary aria-label={`${label}: ${selected.label}. Auswahl öffnen`}><span>{label} <i aria-hidden="true">·</i></span><strong>{selected.label}</strong><i className={styles.chevron} aria-hidden="true" /></summary>
    <nav aria-label={`${label} auswählen`}>{options.map((option) => <Link key={option.value} href={option.href} aria-current={option.value === value ? "page" : undefined}>{option.label}</Link>)}</nav>
  </details>;
}
