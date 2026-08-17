import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { SupabaseAccountProfileRepository } from "@/lib/supabase/accountProfileRepository.server";
import styles from "../dashboard.module.css";
import { AccountHeaderControls } from "@/components/AccountHeaderControls";
import { RedesignBrand, RedesignButtonLink, RedesignFooter, RedesignHeader, RedesignShell } from "@/components/redesign";
import { LegalLinks } from "@/components/LegalLinks";
import { SectionNavigation } from "@/components/SectionNavigation";
import { deleteAccount, saveAccountSettings } from "../actions";
import { ProfileVisibilitySelect } from "@/components/ProfileVisibilitySelect";
import { isAdminAccount } from "@/lib/adminAccess.server";

export const metadata: Metadata = { title: "Kontoeinstellungen", robots: { index: false, follow: false } };
type AccountSettingsProps = { searchParams: Promise<{
  error?: string;
  saved?: string;
  emailPending?: string;
  emailConfirmed?: string;
}> };

function suggestedProfile(email: string) {
  const localPart = email.split("@", 1)[0] || "spieler";
  const cleaned = localPart.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  const handle = Array.from(cleaned || "spieler").slice(0, 24).join("");
  return { handle: handle.length >= 3 ? handle : "spieler", displayName: localPart.slice(0, 40) || "Spieler" };
}

export default async function AccountSettingsPage({ searchParams }: AccountSettingsProps) {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fkonto%2Feinstellungen");
  const params = await searchParams;
  const email = context.user.email ?? "";
  const pendingEmail = context.user.new_email ?? "";
  const [profile, isAdmin] = await Promise.all([
    new SupabaseAccountProfileRepository().findByAccountId(context.identity.account.accountId),
    isAdminAccount(context.identity.account.accountId)
  ]);
  const suggestion = suggestedProfile(email);

  return (
    <main className={styles.page}>
      <div className={`${styles.frame} ${styles.frameNoAds}`}>
        <RedesignShell className={styles.app}>
          <RedesignHeader className={styles.subpageTop}>
            <RedesignBrand className={styles.brand} />
            <div className={styles.toplinks}>
              <RedesignButtonLink href="/solo-modus" tone="primary" className={styles.toplink}>Spielen</RedesignButtonLink>
              <AccountHeaderControls />
            </div>
          </RedesignHeader>
          <SectionNavigation section="account" admin={isAdmin} />
          <div className={styles.narrowShell}>
            <h1 className={styles.subpageTitle}>Kontoeinstellungen</h1>
            <p className={styles.settingsLead}>Verwalte hier deine persönliche Ansprache, deine öffentliche Identität und deine Login-Daten.</p>
            {params.error && <p className={`${styles.notice} ${styles.error}`} role="alert">{params.error}</p>}
            {params.saved && <p className={`${styles.notice} ${styles.success}`} role="status">Einstellungen gespeichert.</p>}
            {params.emailPending && <p className={`${styles.notice} ${styles.pending}`} role="status">
              Die Änderung zu <strong>{pendingEmail || "der neuen Adresse"}</strong> wartet auf Bestätigung. Bitte öffne die Bestätigungslinks im bisherigen und im neuen E-Mail-Postfach. Bis beide bestätigt sind, bleibt <strong>{email}</strong> die Login-Adresse.
            </p>}
            {params.emailConfirmed && pendingEmail && <p className={`${styles.notice} ${styles.pending}`} role="status">
              Eine Bestätigung ist angekommen. Bitte bestätige zusätzlich den Link im jeweils anderen Postfach. Aktuell bleibt <strong>{email}</strong> die Login-Adresse.
            </p>}
            {params.emailConfirmed && !pendingEmail && <p className={`${styles.notice} ${styles.success}`} role="status">
              Deine E-Mail-Adresse wurde erfolgreich geändert. Ab jetzt meldest du dich mit <strong>{email}</strong> an.
            </p>}
            <form id="account-settings-form" action={saveAccountSettings} className={styles.settingsForm}>
              <section className={styles.settingsSection}>
                <h2>Profil</h2>
                <div className={styles.field}>
                  <label htmlFor="displayName">Persönlicher Name</label>
                  <input id="displayName" name="displayName" defaultValue={profile?.displayName ?? suggestion.displayName} maxLength={40} required />
                  <p className={styles.help}>So sprechen wir dich persönlich an, zum Beispiel in der Begrüßung. Dieser Name ist nicht öffentlich und muss nicht eindeutig sein.</p>
                </div>
                <div className={styles.field}>
                  <label htmlFor="handle">Öffentlicher Benutzername</label>
                  <input id="handle" name="handle" defaultValue={profile?.handle ?? suggestion.handle} maxLength={24} pattern="[A-Za-zÀ-ž0-9._-]{3,24}" required />
                  <p className={styles.help}>Deine eindeutige öffentliche Identität. Sie erscheint als @Name in Rankings, Community-Beiträgen und anderen öffentlichen Bereichen.</p>
                </div>
                <div className={styles.field}>
                  <label htmlFor="visibility">Profil-Sichtbarkeit</label>
                  <ProfileVisibilitySelect defaultValue={profile?.visibility ?? "public"} />
                </div>
              </section>
              <section className={styles.settingsSection}>
                <h2>Anmeldung</h2>
                <div className={styles.field}>
                  <label htmlFor="email">E-Mail-Adresse</label>
                  <input id="email" name="email" type="email" defaultValue={pendingEmail || email} autoComplete="email" required />
                  {pendingEmail
                    ? <p className={styles.help}>Aktuelle Login-Adresse: {email}. Änderung zu {pendingEmail} ist noch nicht vollständig bestätigt. Öffne dazu die Links im alten und im neuen Postfach.</p>
                    : <p className={styles.help}>Bei einer Änderung senden wir je einen Bestätigungslink an die bisherige und die neue Adresse. Erst nach beiden Bestätigungen wechselt deine Login-Adresse.</p>}
                </div>
                <div className={styles.field}>
                  <label htmlFor="password">Neues Passwort vergeben <span className={styles.optional}>(optional)</span></label>
                  <input id="password" name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="passwordConfirmation">Neues Passwort wiederholen</label>
                  <input id="passwordConfirmation" name="passwordConfirmation" type="password" minLength={8} maxLength={128} autoComplete="new-password" />
                </div>
              </section>
              <div className={styles.settingsSaveRow}>
                <button type="submit" className={styles.save}>Einstellungen speichern</button>
              </div>
            </form>
            <section className={`${styles.settingsSection} ${styles.dataSection}`}>
              <h2>Datenschutz &amp; Daten</h2>
              <p className={styles.privateNote}>Dein Profil kann öffentlich für Rankings oder privat geführt werden. Hier kannst du deine gespeicherten Kontodaten herunterladen oder dein Konto endgültig löschen.</p>
              <details className={styles.exportZone}>
                <summary>Datenexport vorbereiten</summary>
                <p>CSV ist für Tabellenprogramme und enthält deine gespeicherten Spiele. JSON ist der vollständige, maschinenlesbare Kontodatenexport. Aus Sicherheitsgründen musst du den Export bestätigen.</p>
                <form action="/konto/datenexport" method="post" className={styles.deleteForm}>
                  {context.provider === "email" ? <div className={styles.field}>
                    <label htmlFor="exportPassword">Aktuelles Passwort</label>
                    <input id="exportPassword" name="currentPassword" type="password" minLength={8} maxLength={128} autoComplete="current-password" required />
                  </div> : <p className={styles.help}>Deine letzte Google-Anmeldung muss weniger als zehn Minuten zurückliegen.</p>}
                  <div className={styles.field}>
                    <label htmlFor="exportConfirmation">Zur Bestätigung EXPORTIEREN eingeben</label>
                    <input id="exportConfirmation" name="confirmation" type="text" autoComplete="off" pattern="EXPORTIEREN" required />
                  </div>
                  <div className={styles.exportActions}>
                    <button type="submit" name="format" value="csv" className={styles.secondaryButton}>Spiele als CSV herunterladen</button>
                    <button type="submit" name="format" value="json" className={styles.secondaryButton}>Vollständige Daten als JSON</button>
                  </div>
                </form>
              </details>
              <details className={styles.dangerZone}>
                <summary>Konto endgültig löschen</summary>
                <p>Dadurch werden dein Login, dein Profil, deine Ranking-Spiele und die zugehörigen personenbezogenen Daten dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
                <form action={deleteAccount} className={styles.deleteForm}>
                  {context.provider === "email" ? <div className={styles.field}>
                    <label htmlFor="currentPassword">Aktuelles Passwort</label>
                    <input id="currentPassword" name="currentPassword" type="password" minLength={8} maxLength={128} autoComplete="current-password" required />
                  </div> : <p className={styles.help}>Aus Sicherheitsgründen muss deine letzte Anmeldung weniger als zehn Minuten zurückliegen.</p>}
                  <div className={styles.field}>
                    <label htmlFor="confirmation">Zur Bestätigung LÖSCHEN eingeben</label>
                    <input id="confirmation" name="confirmation" type="text" autoComplete="off" pattern="LÖSCHEN" required />
                  </div>
                  <button type="submit" className={styles.dangerButton}>Konto und Daten endgültig löschen</button>
                </form>
              </details>
            </section>
          </div>
          <RedesignFooter className={styles.footer}><LegalLinks includeInfos align="end" /></RedesignFooter>
        </RedesignShell>
      </div>
    </main>
  );
}
