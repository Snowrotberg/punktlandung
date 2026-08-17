# Passkeys – Notiz für später

Passkeys erst nach dem nächsten Launch als eigene Beta umsetzen. Supabase führt die Funktion derzeit noch als experimentell; die API kann sich ohne Vorankündigung ändern.

## Voraussetzungen

- Supabase Authentication → Passkeys aktivieren.
- RP-Anzeigename: `Punktlandung`.
- Dauerhafte RP-ID: `punktlandung.app`.
- Erlaubte Origins: `https://punktlandung.app` und `https://www.punktlandung.app`.
- Im Supabase-Client `auth.experimental.passkey: true` aktivieren.
- Im Konto Passkey registrieren, benennen, anzeigen und löschen können.
- Auf der Anmeldung „Mit Passkey anmelden“ ergänzen.
- Registrierung nur für bereits bestätigte und angemeldete Konten anbieten.
- Tests mit Windows Hello, Apple/iCloud-Schlüsselbund, Google Passwortmanager, 1Password sowie gängigen Desktop- und Mobilbrowsern durchführen.

## Wichtige Entscheidung

Die RP-ID vor der ersten Registrierung endgültig festlegen. Eine spätere Änderung macht alle bis dahin registrierten Passkeys unbrauchbar.

Dokumentation: https://supabase.com/docs/guides/auth/passkeys
