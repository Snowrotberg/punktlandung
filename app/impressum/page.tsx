import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";
import { absoluteUrl } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Impressum",
  alternates: { canonical: absoluteUrl("/impressum") }
};

export default function ImpressumPage() {
  return (
    <InfoPageShell compact fillDesktop plainContent eyebrow="Rechtliches" title="Impressum" intro="Anbieterkennzeichnung und Kontaktangaben zu Punktlandung.">
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Angaben gemäß § 5 DDG</h2>
          <p>Punktlandung<br />Tim Kleinheins, Einzelunternehmer<br />Pfauenbergsteige 84<br />73732 Esslingen<br />Deutschland</p>
        </section>
        <section className={styles.card}>
          <h2>Kontakt & Umsatzsteuer-ID</h2>
          <p>E-Mail: <a href="mailto:aintartstudio@gmail.com">aintartstudio@gmail.com</a></p>
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:<br />DE314498696</p>
        </section>
        <section className={styles.card}>
          <h2>Verantwortlich für den Inhalt</h2>
          <p>Verantwortlich für journalistisch-redaktionelle Inhalte gemäß § 18 Abs. 2 MStV ist Tim Kleinheins, Anschrift wie oben.</p>
        </section>
        <section className={styles.card}>
          <h2>Verbraucherstreitbeilegung</h2>
          <p>Ich bin nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
        </section>
      </div>
    </InfoPageShell>
  );
}
