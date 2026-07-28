# Technische SEO-Abnahme vom 28. Juli 2026

## Umfang

Geprüft wurden die Live-Domain, Domainvarianten, Canonicals, `robots.txt`,
`sitemap.xml` und die Indexierungsabsicht der Anwendungsrouten. Die sichtbare
und funktionelle Spieloberfläche war nicht Gegenstand der Änderungen.

## Live-Befund vor den Änderungen

| Prüfung | Ergebnis |
| --- | --- |
| `https://punktlandung.app/` | HTTP 200 |
| `https://www.punktlandung.app/` | HTTP 200 statt permanenter Weiterleitung |
| Canonical der Startseite | `https://punktlandung.app` |
| `robots.txt` | HTTP 200, Sitemap korrekt referenziert |
| `sitemap.xml` | HTTP 200, elf beabsichtigte Inhalts-/Rechtsseiten |
| Sitemap-Aktualität | alle URLs erhielten bei jedem Build denselben neuen Zeitstempel |
| Spielzustände | unter anderem `/spielen`, `/warteraum` und `/endergebnis` waren `index, follow` |

## Im Repository korrigiert

- Künstliches `lastModified` aus der Sitemap entfernt. Es wird erst wieder
  ergänzt, wenn pro Inhalt ein belastbares Änderungsdatum vorliegt.
- Folgende Funktions- und Zustandsseiten auf `noindex, nofollow` gesetzt:
  `/spielen`, `/solo-modus`, `/party-modus`, `/online-modus`, `/warteraum`,
  `/aufloesung`, `/endergebnis` und `/feedback`.
- Die notwendige permanente Weiterleitung von `www` auf die Hauptdomain in der
  Deployment-Dokumentation festgehalten.

## Noch extern umzusetzen oder zu prüfen

- [ ] Reverse-Proxy: `www` mit 301 oder 308 auf non-`www` weiterleiten.
- [ ] Geänderten Stand deployen.
- [ ] Live-Metadaten der `noindex`-Routen nach dem Deployment erneut abrufen.
- [ ] Neue Sitemap prüfen: keine pauschalen `lastmod`-Werte mehr.
- [x] Google-Search-Console-Domain-Property per DNS-TXT bestätigt.
- [x] Sitemap in Google Search Console eingereicht; der erste Abruf stand am
  28. Juli 2026 zunächst auf „Konnte nicht abgerufen werden“, obwohl der
  unabhängige Live-Test für Browser und Googlebot HTTP 200 mit
  `application/xml` lieferte. Nach der initialen Verarbeitung erneut prüfen.
- [ ] Sitemap in Bing Webmaster Tools einreichen.
- [ ] URL-Prüfung für Startseite, FAQ und zwei Landingpages ausführen.
- [ ] Strukturierte Daten der Startseite und FAQ mit einem Validator prüfen.

## Ausstehende Betreiberentscheidung

Entscheidung vom 28. Juli 2026: KI-Suche und nutzerinitiierte Abrufe sind
erlaubt, eindeutig getrennte Trainings-Crawler werden gesperrt.

- erlaubt: `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`,
  `Perplexity-User`, `Claude-SearchBot` und `Claude-User`
- gesperrt: `GPTBot`, `ClaudeBot` und `Google-Extended`

Die allgemeine Freigabe für Suchmaschinen bleibt bestehen. Die Liste wird
quartalsweise mit den offiziellen Anbieterinformationen abgeglichen, weil sich
Bot-Namen und Verwendungszwecke ändern können.
