# Incident-Runbook

1. Betroffene Produktionsfunktion begrenzen oder die letzte bekannte sichere Version bereitstellen.
2. Deploy-, Supabase-, E-Mail- und sonstige betroffene Schlüssel rotieren; aktive Sitzungen widerrufen, wenn Auth-Daten betroffen sein könnten.
3. Reverse-Proxy-, Anwendungs-, Supabase- und Integritätslogs schreibgeschützt sichern. Keine sensiblen Inhalte in GitHub-Issues kopieren.
4. Abweichung mit Release-Manifest, Deployment-Historie und CSP-Berichten eingrenzen.
5. Ursache beheben, Tests ausführen und eine bekannte Version kontrolliert wiederherstellen.
6. Prüfen, ob personenbezogene Daten betroffen waren und welche gesetzlichen oder vertraglichen Benachrichtigungen erforderlich sind.
7. Bei einer Phishing-Kopie Belege sichern, Hoster/Registrar melden sowie Safe Browsing und Suchmaschinen-Takedown anstoßen.

GitHub-Monitoring-Issues enthalten nur Prüfergebnis und Workflow-Link. Tokens, Cookies, Passwörter und Formulardaten gehören niemals hinein.
