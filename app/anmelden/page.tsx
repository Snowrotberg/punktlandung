import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeAuthReturnPath } from "@/lib/authNavigation";
import { getSupabaseAccountContext, googleLoginEnabled, supabaseAccountsEnabled } from "@/lib/supabase/auth.server";
import { signIn, signInWithGoogle, signUp } from "./actions";
import styles from "./styles.module.css";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Optional bei Punktlandung anmelden, um Spielstände und Rankings zu nutzen.",
  robots: { index: false, follow: false }
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string; returnTo?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnTo = safeAuthReturnPath(params.returnTo);
  const skipHref = returnTo.startsWith("/konto") ? "/" : returnTo;
  const enabled = supabaseAccountsEnabled();
  const suggestAccountCreation = params.error?.startsWith("Anmeldung nicht möglich.") ?? false;
  if (enabled && await getSupabaseAccountContext()) redirect(returnTo === "/" ? "/konto" : returnTo);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <Link href="/" className={styles.brand}>Punktlandung</Link>
        <h1 id="login-title">Spielstände mitnehmen</h1>
        <p className={styles.intro}>Optional anmelden, um Ergebnisse zu speichern und an Rankings teilzunehmen.</p>

        {params.error && <div className={styles.error} role="alert">
          <strong>{params.error}</strong>
          {suggestAccountCreation && <span>Noch kein Konto? Nutze unten „Konto erstellen“ mit denselben Angaben.</span>}
        </div>}
        {params.message && <p className={styles.message} role="status">{params.message}</p>}
        {!enabled && <p className={styles.message}>Die Technik ist vorbereitet, aber für Spieler noch nicht freigeschaltet.</p>}

        {googleLoginEnabled() && (
          <form action={signInWithGoogle}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className={styles.googleButton} type="submit">
              <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z" />
                <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
                <path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z" />
                <path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
              </svg>
              <span>Mit Google fortfahren</span>
            </button>
          </form>
        )}

        {googleLoginEnabled() && <div className={styles.divider}><span>oder</span></div>}

        <form className={styles.form}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <label>E-Mail-Adresse<input name="email" type="email" autoComplete="email" required disabled={!enabled} /></label>
          <label>Passwort<input name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required disabled={!enabled} /></label>
          <div className={styles.actions}>
            <button formAction={signIn} disabled={!enabled}>Anmelden</button>
            <button formAction={signUp} className={styles.secondary} disabled={!enabled}>Konto erstellen</button>
          </div>
        </form>

        <p className={styles.note}>Persönliche Angaben legst du später im Profil fest.</p>
        <Link href={skipHref} className={styles.skip}>Ohne Anmeldung weiterspielen</Link>
      </section>
    </main>
  );
}
