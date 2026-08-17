# Punktlandung Auth-E-Mails

## Bestätigungsmail einrichten

1. In Supabase **Authentication → Emails → Templates → Confirm signup** öffnen.
2. Als Betreff `Punktlandung – E-Mail-Adresse bestätigen` eintragen.
3. Den Inhalt aus `confirmation.html` einsetzen und speichern.
4. Eine neue Testadresse registrieren und Link sowie Rückleitung prüfen.

`{{ .ConfirmationURL }}` muss unverändert im Button erhalten bleiben. Es enthält den einmaligen Bestätigungslink und die von Punktlandung gesetzte Rückleitungsadresse.

Der zusätzliche Link `Punktlandung.app` im Footer führt unabhängig vom einmaligen Bestätigungslink auf die öffentliche Website. Er enthält keine Authentifizierungsdaten und kann deshalb unverändert bleiben.

## Absender vollständig branden

Die Vorlage ändert Inhalt und Betreff. Für einen Absender wie

`Punktlandung <konto@auth.punktlandung.app>`

muss unter **Authentication → Emails → SMTP Settings** zusätzlich ein eigener SMTP-Dienst eingerichtet werden. Dafür werden SMTP-Host, Port, Benutzer, Passwort, Absenderadresse und der Absendername `Punktlandung` benötigt. Für den Produktivbetrieb außerdem SPF, DKIM und DMARC beim verwendeten Mail-Dienst konfigurieren.

Der Supabase-Standardversand ist nur für Entwicklung gedacht. Bei neueren Free-Projekten ist für eigene Templates zudem ein eigener SMTP-Dienst oder ein kostenpflichtiger Supabase-Tarif erforderlich.
