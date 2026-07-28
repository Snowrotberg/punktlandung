# Analytics und Wochenbericht

## GA4-Property anlegen

1. `https://analytics.google.com/` öffnen und unten links **Verwaltung** wählen.
2. **Property erstellen** wählen.
3. Name `Punktlandung`, Zeitzone `Deutschland` und Währung `Euro` einstellen.
4. Als Plattform **Web** wählen.
5. Website-URL `https://punktlandung.app` und Streamname `Punktlandung Website` eintragen.
6. Die Mess-ID im Format `G-...` kopieren und als `NEXT_PUBLIC_GA_MEASUREMENT_ID` konfigurieren.
7. Unter **Verwaltung > Datenerhebung und -änderung > Datenaufbewahrung** zwei Monate wählen.

Es werden nur grobe Produkt-Ereignisse gesendet. Namen, Raumcodes, E-Mail-Adressen, Feedbacktexte, Tipps und Koordinaten dürfen nicht als Ereignisparameter ergänzt werden.

## KI-Verweise in GA4 auswerten

Punktlandung ergänzt beim `page_view` zwei datensparsame Parameter:

- `entry_referral_group`: `chatgpt`, `perplexity`, `claude`, `gemini`,
  `copilot`, `direct`, `internal` oder `external`
- `entry_referral_host`: ausschließlich der Hostname der verweisenden Seite,
  niemals Pfad, Suchanfrage oder Query-Parameter

Nach dem Deployment in **Verwaltung > Datenanzeige > Benutzerdefinierte
Definitionen** beide Parameter als ereignisbezogene benutzerdefinierte
Dimensionen anlegen. Danach in **Erkunden** einen Bericht mit
`entry_referral_group`, Landingpage, Sitzungen, `game_start` und
`game_complete` erstellen. Kleine Fallzahlen nicht überinterpretieren.

## Google-CMP verbinden

In AdSense unter **Datenschutz und Mitteilungen > Europäische Verordnungen > Einstellungen** den Einwilligungsmodus für Werbe- und Analysezwecke aktivieren. Danach den Dialog mit Zustimmung, Ablehnung und erneutem Öffnen über den Link **Cookies** testen.

## Monatlichen GA4-Bericht planen

1. In GA4 **Berichte** öffnen und den gewünschten Standard- oder benutzerdefinierten Bericht auswählen.
2. Oben rechts **Diesen Bericht teilen > E-Mail planen** wählen.
3. Empfänger `aintartstudio@gmail.com`, Frequenz **monatlich** und PDF einstellen.
4. Wegen der möglichen Verarbeitungszeit den ersten Versand auf den vierten Tag eines Monats legen.
5. Geplante Berichte laufen höchstens zwölf Monate und müssen anschließend verlängert werden.

## Anonymer Wochenbericht vom VPS

Der WebSocket-Server und `/api/usage` schreiben ausschließlich anonyme Ereignisse in den unter `USAGE_METRICS_FILE` konfigurierten Pfad. Auf dem VPS sollte dafür ein dauerhaft beschreibbarer Pfad außerhalb des Release-Verzeichnisses verwendet werden, zum Beispiel `/var/lib/punktlandung/usage-events.ndjson`.

Der Versand kann nach dem Deployment mit einem wöchentlichen Cronjob eingerichtet werden:

```cron
0 8 * * 1 cd /PFAD/ZUR/APP && /usr/bin/npm run report:usage
```

Der Prozess benötigt `FEEDBACK_GMAIL_USER`, `FEEDBACK_GMAIL_APP_PASSWORD`, `USAGE_REPORT_TO_EMAIL` und `USAGE_METRICS_FILE`. Vor Aktivierung des Cronjobs einmal manuell mit `npm run report:usage` testen.
