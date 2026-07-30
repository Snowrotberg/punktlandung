# SEO-/GEO-Mess-Baseline

Beginn: 28. Juli 2026

Diese Datei hält die Ausgangslage vor den nächsten inhaltlichen
SEO-/GEO-Änderungen fest. Werte werden monatlich mit identischen Zeiträumen
ergänzt. Leere Felder bedeuten nicht null, sondern „noch nicht erhoben“.

## Technische Ausgangslage

| Kennzahl | Ausgangswert |
| --- | --- |
| kanonische Domain | `https://punktlandung.app` |
| Sitemap | erreichbar, in Google Search Console erfolgreich, 13 beabsichtigte URLs |
| robots.txt | erreichbar |
| KI-Suchcrawler | erlaubt |
| getrennte Trainings-Crawler | gesperrt |
| indexierbare Kernseiten im Repository | 13 |
| `noindex`-Funktionsseiten | 8 |
| Produktions-Build | erfolgreich am 29. Juli 2026 |
| TypeScript-Prüfung | erfolgreich am 29. Juli 2026 |
| Responsive-Checks | Startseite und zwei neue Kernseiten jeweils 6/6 bestanden |
| lokale Lighthouse-Baseline | dokumentiert am 29. Juli 2026 |
| aktiver Orts-/Aufgabenkatalog | 1.462 spielbare Einträge |

Katalogverteilung nach den aktiven Qualitätsfiltern: 379 Städte,
351 Hauptstädte, 264 Wahrzeichen, 263 Landschaften und 205 Flaggen.

## Google Search Console

Die Domain-Property ist per DNS bestätigt und die Sitemap wurde erfolgreich
verarbeitet. Die folgenden Leistungswerte werden ergänzt, sobald Search Console
ausreichend Daten gesammelt hat.

| Zeitraum | Impressionen | Klicks | CTR | mittlere Position |
| --- | ---: | ---: | ---: | ---: |
| letzte 28 Tage |  |  |  |  |
| vorherige 28 Tage |  |  |  |  |
| letzte 90 Tage |  |  |  |  |

Zusätzlich erfassen:

- zehn stärkste nicht-markenbezogene Suchanfragen
- zehn stärkste Landingpages
- indexierte und ausgeschlossene Seiten mit Begründung
- Core Web Vitals für Mobile und Desktop
- Verfügbarkeit des Berichts für generative KI-Funktionen

## Bing Webmaster Tools

| Zeitraum | Impressionen | Klicks | CTR | mittlere Position |
| --- | ---: | ---: | ---: | ---: |
| letzte 28 Tage |  |  |  |  |
| letzte 90 Tage |  |  |  |  |

## GA4 und Produktnutzung

| Kennzahl, letzte 28 Tage | Ausgangswert |
| --- | ---: |
| Nutzer |  |
| Sitzungen |  |
| organische Sitzungen |  |
| direkte Sitzungen |  |
| KI-Referral-Sitzungen |  |
| `game_start` |  |
| `game_complete` |  |
| Start-zu-Abschluss-Rate |  |

Ab dem nächsten Deployment werden KI-Referrals über
`entry_referral_group` getrennt erfasst. Die Conversion wird nicht nur als
Traffic, sondern anhand von `game_start` und `game_complete` bewertet.

## Monatliches KI-Antwort-Monitoring

Pro System und Frage werden Datum, Sprache, Nennung, verlinkte Quelle,
Korrektheit und sichtbare Wettbewerber dokumentiert. Einzelne Antworten sind
nur Beobachtungen; bewertet wird die Entwicklung über mehrere Monate.

| Frage | ChatGPT | Perplexity | Claude | Gemini |
| --- | --- | --- | --- | --- |
| kostenlose GeoGuessr-Alternative auf Deutsch |  |  |  |  |
| Geografie-Spiel ohne Anmeldung im Browser |  |  |  |  |
| Geo-Quiz für einen Spieleabend |  |  |  |  |
| Orte-Erraten-Spiel mit Punktevergabe |  |  |  |  |
| deutschsprachige Spiele zum Orte erraten |  |  |  |  |

## Messregeln

- Immer 28 Tage mit den direkt vorhergehenden 28 Tagen vergleichen.
- Marken- und Nicht-Marken-Suchanfragen getrennt betrachten.
- Deployment-Daten im Bericht markieren.
- Keine Namen, Raumcodes, E-Mail-Adressen, Tipps oder Koordinaten erfassen.
- Kleine Fallzahlen nicht als belastbaren Trend darstellen.
