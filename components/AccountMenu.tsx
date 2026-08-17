"use client";

import { UserRound } from "lucide-react";
import styles from "./AccountMenu.module.css";

type AccountMenuProps = { authenticated: boolean; showPlayLink?: boolean };

export function AccountMenu({ authenticated, showPlayLink = true }: AccountMenuProps) {
  if (!authenticated) {
    return <a className={styles.icon} href="/anmelden" aria-label="Anmelden" data-tooltip="Anmelden"><UserRound aria-hidden="true" /></a>;
  }

  return (
    <div className={styles.menu}>
      <a className={styles.icon} href="/konto" aria-label="Spielerkonto"><UserRound aria-hidden="true" /></a>
      <nav className={styles.dropdown} aria-label="Spielerkonto">
        <p className={styles.label}>Spielerkonto</p>
        <a href="/konto">Übersicht</a>
        <a href="/konto/verlauf">Spielverlauf</a>
        <a href="/rankings">Rankings</a>
        <a href="/konto/einstellungen">Einstellungen</a>
        {showPlayLink && <a href="/solo-modus" className={styles.play}>Spielen</a>}
        <form action="/auth/signout" method="post"><button type="submit" className={styles.logout}>Abmelden</button></form>
      </nav>
    </div>
  );
}
