"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import styles from "./SectionNavigation.module.css";

type NavigationItem = { href: string; label: string; exact?: boolean };

const accountItems: NavigationItem[] = [
  { href: "/konto", label: "Übersicht", exact: true },
  { href: "/konto/verlauf", label: "Spielverlauf" },
  { href: "/rankings", label: "Rankings" },
  { href: "/konto/einstellungen", label: "Einstellungen" }
];

const helpItems: NavigationItem[] = [
  { href: "/faq", label: "Übersicht", exact: true },
  { href: "/so-funktioniert-punktlandung", label: "Spielen & Punkte" },
  { href: "/faq/rankings", label: "Konto & Rankings" },
  { href: "/ortskatalog", label: "Orte & Quellen" },
  { href: "/partyspiel-geografie", label: "Mit Freunden spielen" },
  { href: "/infos", label: "Über Punktlandung" }
];

const legalItems: NavigationItem[] = [
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/impressum", label: "Impressum" },
  { href: "/lizenzen", label: "Lizenzen" }
];

const communityItems: NavigationItem[] = [
  { href: "/community", label: "Ideen & Roadmap", exact: true },
  { href: "/community/meine-vorschlaege", label: "Meine Vorschläge" }
];

const helpPaths = new Set(helpItems.map((item) => item.href));
const legalPaths = new Set(legalItems.map((item) => item.href));

function isActive(pathname: string, item: NavigationItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SectionNavigation({ section, admin = false }: { section?: "account" | "help" | "legal" | "community"; admin?: boolean }) {
  const pathname = usePathname() ?? "";
  const linksRef = useRef<HTMLElement>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{ from: string; to: string } | null>(null);
  const activePathname = pendingNavigation?.from === pathname ? pendingNavigation.to : pathname;
  const selectImmediately = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    setPendingNavigation({ from: pathname, to: href });
  };
  const currentSection = section ?? (
    pathname === "/faq" || pathname.startsWith("/faq/") || helpPaths.has(pathname) ? "help" :
    legalPaths.has(pathname) ? "legal" : pathname === "/community" || pathname.startsWith("/community/") ? "community" : "account"
  );
  const items = currentSection === "account"
    ? (admin ? [...accountItems, { href: "/admin", label: "Admin" }] : accountItems)
    : currentSection === "help" ? helpItems : currentSection === "community" ? communityItems : legalItems;
  const label = currentSection === "account" ? "Spielerkonto" : currentSection === "help" ? "Hilfe & Infos" : currentSection === "community" ? "Community" : "Service & Rechtliches";
  const itemCount = items.length + (currentSection === "legal" ? 1 : 0);
  const mobileColumns = itemCount === 3 || itemCount >= 5 ? "3" : "2";

  useEffect(() => {
    const container = linksRef.current;
    const activeLink = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !activeLink) return;

    container.scrollTo({
      left: activeLink.offsetLeft - (container.clientWidth - activeLink.offsetWidth) / 2,
      behavior: pendingNavigation ? "smooth" : "auto"
    });
  }, [activePathname, pendingNavigation]);

  return (
    <div className={styles.bar} data-section={currentSection} data-item-count={itemCount} data-mobile-columns={mobileColumns}>
      <span className={styles.label}>{label}</span>
      <nav ref={linksRef} className={styles.links} aria-label={`${label} Bereiche`}>
        {items.map((item) => (
          <span key={item.href} className={styles.itemSlot}>
            <Link href={item.href} onClick={(event) => selectImmediately(event, item.href)} aria-current={isActive(activePathname, item) ? "page" : undefined}>
              {item.label}
            </Link>
          </span>
        ))}
        {currentSection === "legal" && <span className={styles.itemSlot}><CookieSettingsButton className={styles.cookieButton} /></span>}
      </nav>
    </div>
  );
}
