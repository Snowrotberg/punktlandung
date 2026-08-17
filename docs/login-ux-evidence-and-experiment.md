# Login-UX: Evidenz, Empfehlung und Messplan

Stand: 3. August 2026

## Was sich serioes sagen laesst

Die Richtung stimmt: Ein erzwungenes Konto vor der eigentlichen Aufgabe erzeugt
Reibung. Baymard berichtet fuer E-Commerce, dass 24 Prozent der befragten
US-Onlineshopper in einem Quartal mindestens einen Warenkorb allein wegen
erzwungener Kontoerstellung abgebrochen hatten. Die Tests empfehlen, den
Gastpfad sichtbar zu halten und eine freiwillige Kontoerstellung erst nach dem
erfolgreichen Abschluss anzubieten.

Das ist jedoch Checkout-Forschung und kein direkter Messwert fuer ein
Geografie-Spiel. Die Zahl darf deshalb nicht als erwartete Punktlandung-
Abbruchrate ausgegeben werden. Sie begruendet das Muster, nicht dessen exakte
Wirkung.

Google veroeffentlicht ausgewaehlte Sign-in-with-Google-/One-Tap-Fallstudien mit
deutlichen Conversion-Steigerungen, beispielsweise knapp 2x bei Reddit. Diese
Beispiele zeigen, dass ein bestehendes Konto Schritte sparen kann, sind aber
anbieterpublizierte Erfolgsfaelle und keine allgemeine Garantie. Punktlandung
muss den eigenen Funnel messen.

NIST weist sowohl auf Sicherheits- als auch Usability-Probleme von Passwoertern
und besonders belastende Kompositionsregeln hin. E-Mail/Passwort bleibt als
erwartete Ausweichmethode sinnvoll, sollte aber Passwortmanager, Einfuegen,
lange Passphrasen und Wiederherstellung unterstuetzen und keine willkuerlichen
Grossbuchstaben-/Sonderzeichenregeln erfinden.

## Empfehlung fuer Punktlandung

1. Spielen bleibt ohne Konto die primaere und voll sichtbare Option.
2. Erst am fertigen Ergebnis erscheint einmalig: „Ergebnis speichern?“
3. Ablehnen schliesst den Hinweis fuer diese Partie endgueltig.
4. Nach Zustimmung ist **Mit Google fortfahren** auf Web und Android die erste
   Methode, weil dort sehr viele Nutzer bereits angemeldet sind.
5. **Mit E-Mail fortfahren** bleibt gleichwertig erreichbar. Der Anbieter-Spike
   vergleicht Passwort plus Verifikation mit Magic Link/OTP und Wiederherstellung.
6. **Mit Apple fortfahren** wird technisch im Modell reserviert, aber erst mit
   Apple-Developer-Konfiguration aktiviert. Fuer eine spaetere iOS-App ist
   Apples jeweils aktuelle Review-Regel 4.8 zu beachten.
7. Kein ungefragtes One-Tap-Popup beim Appstart. One Tap/FedCM kann spaeter nur
   nach einem kontrollierten Experiment gegen den normalen Google-Button laufen.
8. Nach OAuth kehrt der Nutzer zum identischen fertigen Spiel zurueck; der Claim
   startet automatisch und idempotent.
9. Providername, E-Mail und Providerfoto werden nicht automatisch zum
   oeffentlichen Profil.

## Apple-Einordnung

Apple verlangt bei Apps mit einem primaeren Drittanbieter-/Social-Login eine
gleichwertige datensparsame Login-Alternative, sofern keine Ausnahme greift.
Die aktuelle Formulierung nennt nicht mehr ausschliesslich „Sign in with Apple“,
Apple Login ist fuer eine spaetere iOS-Ausgabe dennoch die risikoarme und
nutzerfreundliche Planung. Fuer die reine Android-TWA besteht diese App-Store-
Pflicht nicht. Sign in with Apple fuer Websites setzt Apple-Konfiguration und
eine zugehoerige App voraus.

## Messbarer Punktlandung-Funnel

Alle Ereignisse werden nur aggregiert und ohne E-Mail, Handle, Raumcode,
Tippkoordinaten oder Provider-Subject erfasst:

| Kennzahl | Berechnung |
| --- | --- |
| Prompt-Annahme | `save_prompt_accept / save_prompt_view` |
| Prompt-Ablehnung | `save_prompt_dismiss / save_prompt_view` |
| Methodenanteil | `auth_method_selected` je Google, E-Mail, Apple |
| Auth-Abschluss | `auth_success / auth_method_selected` je Methode und Surface |
| Claim-Abschluss | `game_claim_success / auth_success` |
| Gesamt gespeichert | `game_claim_success / save_prompt_view` |
| Technischer Fehler | `auth_failure` und `game_claim_failure` je stabilem Fehlercode |

Surface wird nur als `web_desktop`, `web_mobile` oder `android_twa` gespeichert.
Vor einer Produktentscheidung braucht jede Variante ausreichend Volumen und
einen vorher definierten Auswertungszeitraum; kleine Unterschiede werden nicht
als bewiesen interpretiert.

## Abnahmekriterien im Anbieter-Spike

- Google, E-Mail-Neuanlage, E-Mail-Login, Verifikation, Abmeldung und
  Wiederherstellung funktionieren.
- Abgebrochener OAuth-Flow verliert weder Endergebnis noch Gastberechtigung.
- Mehrfacher Callback beziehungsweise Claim erzeugt keinen zweiten Account und
  keine doppelten Punkte.
- Gleiche verifizierte E-Mail ueber zwei Methoden fuehrt nicht unkontrolliert zu
  Account-Duplikaten oder Account-Uebernahme; Linking verlangt eine bestehende
  authentifizierte Sitzung.
- Android-TWA: Browserwechsel, Zurueck-Taste, Prozessneustart und OAuth-Rueckkehr
  sind getestet.
- Erst danach wird entschieden, ob E-Mail/Passwort, Magic Link oder beides im
  MVP sichtbar ist.

## Quellen

- Baymard, Guest Checkout und erzwungene Konten:
  https://baymard.com/blog/make-guest-checkout-prominent
- Baymard, Konto erst nach Abschluss anbieten:
  https://baymard.com/blog/delayed-account-creation
- Google Identity, ausgewaehlte Sign-in-Fallstudien:
  https://developers.google.com/identity/sign-in/case-studies
- NIST SP 800-63B, Passwortstaerke und Usability:
  https://pages.nist.gov/800-63-4/sp800-63b/passwords/
- Apple App Review Guidelines, insbesondere 4.8 und Account Sign-In:
  https://developer.apple.com/app-store/review/guidelines/
- Sign in with Apple fuer Websites und andere Plattformen:
  https://developer.apple.com/sign-in-with-apple/usage-guidelines-for-websites-and-other-platforms/
