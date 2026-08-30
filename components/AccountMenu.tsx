"use client";

import { UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./AccountMenu.module.css";

type AccountMenuProps = { authenticated: boolean; showPlayLink?: boolean };

export function AccountMenu({ authenticated, showPlayLink = true }: AccountMenuProps) {
  const [admin, setAdmin] = useState(false);
  const pathname = usePathname() ?? "";
  const current = (href: string, exact = false) => exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    void fetch("/api/account/access", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ admin?: boolean }> : null)
      .then((result) => setAdmin(result?.admin === true))
      .catch(() => undefined);
    return () => controller.abort();
  }, [authenticated]);

  if (!authenticated) {
    return <a className={styles.icon} href="/anmelden" aria-label="Anmelden" data-tooltip="Anmelden"><UserRound aria-hidden="true" /></a>;
  }

  return (
    <div className={styles.menu}>
      <a className={styles.icon} href="/konto" aria-label="Spielerkonto"><UserRound aria-hidden="true" /></a>
      <nav className={styles.dropdown} aria-label="Spielerkonto">
        <p className={styles.label}>Spielerkonto</p>
        <a href="/konto" aria-current={current("/konto", true) ? "page" : undefined}>Übersicht</a>
        <a href="/konto/verlauf" aria-current={current("/konto/verlauf") ? "page" : undefined}>Spielverlauf</a>
        <a href="/rankings" aria-current={current("/rankings") ? "page" : undefined}>Rankings</a>
        <a href="/konto/einstellungen" aria-current={current("/konto/einstellungen") ? "page" : undefined}>Einstellungen</a>
        {admin && <a href="/admin" aria-current={current("/admin") ? "page" : undefined}>Admin-Bereich</a>}
        {showPlayLink && <a href="/solo-modus" className={styles.play}>Spielen</a>}
        <form action="/auth/signout" method="post"><button type="submit" className={styles.logout}>Abmelden</button></form>
      </nav>
    </div>
  );
}
