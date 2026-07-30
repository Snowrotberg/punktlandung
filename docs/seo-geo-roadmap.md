# SEO-, AEO- und GEO-Umsetzungsplan für Punktlandung

Stand: 29. Juli 2026

## Zielbild

Punktlandung soll für klassische Suchmaschinen und KI-Antwortsysteme als klar
erkennbare, verlässliche deutschsprachige Quelle zu Geo-Guessing-Spielen
auffindbar sein. Der Weg dorthin ist keine separate „KI-SEO“-Disziplin:
technische Indexierbarkeit, hilfreiche Inhalte, echte Produkterfahrung,
nachweisbare Fakten, externe Erwähnungen und eine saubere Messung greifen
ineinander.

Eine Platzierung oder Nennung kann nicht garantiert werden. Wir schaffen
stattdessen überprüfbare Voraussetzungen und verbessern sie anhand echter Daten.

## Bestandsaufnahme

### Bereits vorhanden

- Next.js-Seiten mit individuellen Titles, Descriptions und Canonicals
- `robots.txt` und `sitemap.xml`
- OpenGraph- und Social-Metadaten
- `WebSite`- und `VideoGame`-Daten per JSON-LD
- sichtbare FAQ mit passendem `FAQPage`-Markup
- fünf Landingpages für unterschiedliche Suchintentionen
- serverseitig lesbare Informationsseiten
- interne Navigation zu den wichtigen Seiten
- GA4-Integration und Produkt-Events
- eigener aktiver Datenbestand mit aktuell 1.462 spielbaren Einträgen:
  379 Städte, 351 Hauptstädte, 264 Wahrzeichen, 263 Landschaften und 205 Flaggen

### Größte Lücken

- Die Produktionsdomain ist im lokalen Setup nicht als
  `NEXT_PUBLIC_APP_URL` hinterlegt; die produktive Konfiguration muss geprüft
  werden.
- Die Sitemap setzt bei jedem Build alle Seiten auf „jetzt geändert“, auch wenn
  ihr Inhalt unverändert ist.
- Such-Crawler und Trainings-Crawler sind in der Crawler-Policy noch nicht
  bewusst getrennt.
- Die bestehenden Landingpages sind sehr kurz und enthalten überwiegend
  allgemeine Aussagen, die auch andere Seiten liefern könnten.
- Eigene Katalogdaten, Spielmechanik, Tests und Produktentscheidungen werden
  noch nicht als belegbare Inhalte genutzt.
- Es gibt noch keine dokumentierte Core-Web-Vitals-Baseline.
- KI-Referrals und Nennungen in KI-Antworten werden noch nicht separat
  ausgewertet.
- Externe Erwähnungen, authentische Bewertungen und eigene direkte Kanäle
  fehlen noch weitgehend.

## Priorisierung

| Prio | Arbeitspaket | Nutzen | Aufwand | Abhängigkeit |
| --- | --- | --- | --- | --- |
| P0 | 1. Produktions- und Indexierungsbasis verifizieren | sehr hoch | klein | Live-Domain/Zugänge |
| P0 | 2. Crawler-Policy sauber trennen | hoch | klein | Betreiberentscheidung zu Training |
| P0 | 3. Mess-Baseline anlegen | sehr hoch | mittel | Search-Console-/Bing-Zugang |
| P1 | 4. Seiten direkt und zitierbar strukturieren | hoch | mittel | keine |
| P1 | 5. Eigene Daten und Praxiserfahrung veröffentlichen | sehr hoch | mittel | Faktenprüfung |
| P1 | 6. Dünne Landingpages verbessern oder bündeln | hoch | mittel | erste Suchdaten hilfreich |
| P1 | 7. Performance und Barrierefreiheit messen | hoch | mittel | produktionsnaher Build |
| P2 | 8. Markenentität und Vertrauen stärken | hoch | mittel | finale Betreiberangaben |
| P2 | 9. Echte Drittplattform-Präsenz aufbauen | sehr hoch | laufend | vorzeigbare Zielseiten |
| P2 | 10. Direkten Nutzerkanal etablieren | mittel | mittel | Datenschutz/Einwilligung |
| P2 | 11. Wiederkehrenden GEO-Monitor etablieren | hoch | laufend | Baseline |

## Schritt-für-Schritt-Plan

### Arbeitspaket 1: Produktions- und Indexierungsbasis verifizieren

**Ziel:** Jede gewünschte öffentliche Seite ist unter genau einer produktiven
URL erreichbar, indexierbar und intern auffindbar.

- [x] Finale Hauptdomain `https://punktlandung.app` festgelegt; `www` wird auf
  diese Variante weitergeleitet.
- [x] `NEXT_PUBLIC_APP_URL=https://…` in Produktion anhand der live
  ausgegebenen Canonicals und Sitemap geprüft.
- [ ] HTTP, HTTPS, `www` und non-`www` auf eine Variante weiterleiten. Die
  zusätzliche 308-Weiterleitung in der Next.js-Middleware ist implementiert und
  wird nach dem nächsten Deployment live geprüft.
- [x] Live-Ausgabe von Canonical, `robots.txt` und `sitemap.xml` geprüft.
- [x] Nur öffentliche Informations- und Spiel-Einstiegsseiten indexieren.
  Temporäre Raum-, Warte-, Ergebnis-, Zugangs- und API-Seiten bewusst auf
  Indexierbarkeit prüfen.
- [x] Sitemap in Google Search Console eingereicht und erfolgreich verarbeitet.
- [ ] Sitemap in Bing Webmaster Tools einreichen.
- [ ] Wichtige URLs per URL-Prüfung testen.
- [ ] Rich-Results-/Schema-Validierung für Startseite und FAQ durchführen.
- [x] Echte Änderungsdaten pro Inhalt verwenden oder `lastModified` weglassen,
  statt bei jedem Build künstliche Aktualität zu signalisieren.

**Fertig, wenn:** Es gibt keine falschen Localhost-Canonicals, keine
unerwünschten indexierbaren App-Zustände und keine widersprüchlichen URLs.

### Arbeitspaket 2: Such- und Trainings-Crawler bewusst trennen

**Ziel:** Suchsysteme dürfen Punktlandung finden; die Nutzung für Modelltraining
bleibt eine separate, dokumentierte Betreiberentscheidung.

- [x] Gewünschte Policy schriftlich festhalten:
  „Suche erlauben“ und „Training erlauben/ablehnen“ getrennt entscheiden.
- [x] Für Suche mindestens Googlebot und OAI-SearchBot nicht blockieren.
- [x] PerplexityBot und Claude-SearchBot bei gewünschter Sichtbarkeit ebenfalls
  zulassen; die bestehende `User-agent: *`-Regel erlaubt sie aktuell bereits.
- [x] GPTBot nicht automatisch mit Suchsichtbarkeit gleichsetzen. Er betrifft
  potenzielle Trainingsnutzung und kann unabhängig von OAI-SearchBot behandelt
  werden.
- [x] Dasselbe Prinzip für Google-Extended und ClaudeBot anwenden.
- [ ] Nach Deployment Server-/WAF-Logs auf echte Zugriffe und versehentliche
  403-/429-Antworten prüfen.
- [ ] Keine `llms.txt`- oder ähnliche Spezialdatei als Ranking-Hebel einbauen.

**Fertig, wenn:** Die Policy ist absichtlich gewählt, technisch korrekt
ausgespielt und mit Live-Requests bzw. Logs geprüft.

### Arbeitspaket 3: Mess-Baseline vor weiteren Änderungen

**Ziel:** Spätere Verbesserungen können mit einem Ausgangswert verglichen
werden.

- [ ] In Search Console für die letzten 28 und 90 Tage exportieren:
  Klicks, Impressionen, CTR, Position, Suchanfragen und Zielseiten.
- [ ] Dasselbe in Bing Webmaster Tools erfassen.
- [x] Technische GA4-Kennzeichnung für AI-Referrals vorbereitet; die
  benutzerdefinierten Dimensionen werden nach dem Deployment in GA4 angelegt.
- [ ] In GA4 eine Akquisitionsansicht für organische Suche und AI-Referrals
  anlegen, insbesondere ChatGPT, Perplexity und Claude.
- [ ] Prüfen, ob der im Juni 2026 angekündigte Search-Console-Bericht für
  generative KI-Funktionen für die Property bereits verfügbar ist.
- [ ] Produkt-Baseline ergänzen: Spielstarts, abgeschlossene Spiele,
  Start-zu-Abschluss-Rate und Modus-/Kategorieverteilung.
- [x] Ausgangswerte und Datum in einer monatlichen Messdatei dokumentieren;
  externe Search-Console-, Bing- und GA4-Werte sind noch zu ergänzen.
- [ ] Keine personenbezogenen Daten, Raumcodes, Namen, Tipps oder Koordinaten
  in Analytics aufnehmen.

**Fertig, wenn:** Vor der ersten Inhaltsänderung existiert ein datierter
28-/90-Tage-Snapshot.

### Arbeitspaket 4: Inhalte unmittelbar beantwortbar machen

**Ziel:** Nutzer und Antwortsysteme verstehen den Inhalt eines Abschnitts schon
in den ersten ein bis zwei Sätzen.

- [x] Für die beiden neuen Kernseiten eine konkrete Nutzerfrage und eine
  eindeutige Hauptantwort
  definieren.
- [x] Direkt unter den H1 der beiden Kernseiten eine kurze Antwort mit
  Produktname, Nutzen und
  Einschränkung schreiben.
- [x] Überschriften der beiden Kernseiten als echte Fragen oder klare Themen
  formulieren.
- [x] Wo passend Listen, Vergleichstabellen und kurze Schrittfolgen nutzen.
- [x] Behauptungen auf den Kernseiten mit konkreten, überprüfbaren Fakten statt
  Adjektiven stützen.
- [ ] Ein sichtbares, ehrliches Aktualisierungsdatum nur bei substanzieller
  Überarbeitung anzeigen.
- [x] Wichtige Aussagen der Kernseiten in normalem HTML-Text ausgeben; nicht nur
  in Bildern,
  Canvas oder Interaktionen.
- [ ] FAQ nur um Fragen erweitern, die Nutzer tatsächlich stellen. Keine
  Massen-FAQ zur Keyword-Abdeckung.

**Fertig, wenn:** Jede Seite eine eindeutige Frage beantwortet und ihre
Kernerklärung ohne Spielstart verständlich ist.

### Arbeitspaket 5: Non-Commodity-Content aus dem Produkt entwickeln

**Ziel:** Punktlandung veröffentlicht Informationen, die nicht aus zehn
beliebigen Ratgeberseiten zusammengefasst werden können.

**Erster empfohlener Inhalt: „So funktioniert Punktlandung“**

- [x] Bewertungslogik verständlich und mit echten Beispielen erklären.
- [x] Unterschiede zwischen Solo-, lokalem Party- und Online-Modus transparent
  darstellen.
- [x] Kategorien, Rundenzahl, Spielerzahl und Anmeldung in einer Faktentabelle
  zusammenfassen.
- [ ] Screenshots oder einen kurzen Gameplay-Clip einbinden.

**Zweiter empfohlener Inhalt: „Der Punktlandung-Ortskatalog“**

- [x] Die aktuell 1.462 spielbaren Katalogeinträge und die Verteilung auf fünf Kategorien
  nennen.
- [x] Erklären, wie Orte ausgewählt, Bilder lizenziert und ungeeignete Motive
  ungeeignete Motive ausgeschlossen werden.
- [x] Zahlen beim Build aus den Quelldaten ableiten, damit sie nicht manuell
  veralten.
- [x] Quellen- und Lizenzseite intern verlinken.

**Dritter empfohlener Inhalt: eigene Erkenntnisse**

- [ ] Erst bei ausreichender anonymer Datenmenge aggregierte Erkenntnisse
  veröffentlichen, z. B. beliebte Kategorien oder Abschlussraten.
- [ ] Methodik, Zeitraum und Stichprobengröße sichtbar nennen.
- [ ] Keine kleinen Gruppen, Einzelspieler oder sensiblen Werte ableitbar
  machen.
- [ ] Alternativ einen redaktionellen Praxistest veröffentlichen:
  „Was wir beim Testen eines Geo-Partyspiels auf Handy, Laptop und TV gelernt
  haben“.

**Differenzierungstest:** Vor Veröffentlichung muss jeder Beitrag mindestens
eine eigene Messung, eigene Erfahrung, eigene Methode oder einen exklusiven
Produktfakt enthalten.

**Fertig, wenn:** Mindestens zwei starke, belegbare Inhalte live sind und intern
von den passenden Landingpages verlinkt werden.

### Arbeitspaket 6: Landingpages anhand echter Suchintention verbessern

**Ziel:** Keine Sammlung austauschbarer oder konkurrierender Seiten.

- [ ] Search-Console-Daten prüfen, bevor weitere Keyword-Seiten entstehen.
- [x] Für jede vorhandene Landingpage festhalten:
  Zielanfrage, Nutzerproblem, einzigartige Antwort und gewünschte Aktion.
- [x] Überschneidungen zwischen
  `/geoguessr-alternative-deutsch`,
  `/kostenloses-geoguessing-spiel`,
  `/geografie-spiel` und
  `/orte-erraten-spiel` bewerten.
- [ ] Seiten mit klar unterschiedlicher Intention vertiefen.
- [ ] Seiten ohne eigenen Nutzen zusammenführen und sauber weiterleiten.
- [ ] Vergleichsseite fair und faktisch gestalten: Funktionen, Kosten,
  Anmeldung, Spielmodi, Plattform und Grenzen; keine unbelegten
  Überlegenheitsbehauptungen.
- [ ] Kontextuelle interne Links setzen, nicht bloß eine Linkliste.

**Fertig, wenn:** Jede indexierbare Seite einen erkennbar eigenen Wert besitzt
und nicht nur dieselbe Produktbeschreibung umformuliert.

### Arbeitspaket 7: Performance, Rendering und Zugänglichkeit

**Ziel:** Gute mobile Nutzererfahrung und zuverlässig lesbarer Server-Output.

- [x] Lighthouse-Baseline für Startseite und wichtigste
  Informationsseite auf Mobile und Desktop erfassen.
- [ ] LCP, INP und CLS mit Feldwerten aus Search Console bzw. GA4 ergänzen,
  sobald genug Daten vorliegen.
- [x] Große Start-, Karten-, Kategorie- und Modus-Bilder auf Format, Maße und
  Kompression prüfen; die 13 unmittelbar verwendeten PNG-/JPEG-Dateien wurden
  als WebP von rund 12,3 MiB auf rund 1,0 MiB reduziert.
- [ ] Nicht sichtbare Spiel-Assets lazy laden, sofern dadurch der Spielstart
  nicht schlechter wird.
- [x] Servergerendertes HTML der Informationsseiten stichprobenartig lesen.
- [ ] Überschriftenhierarchie, Linktexte, Bild-Alternativtexte, Tastaturbedienung
  und Farbkontraste prüfen.
- [x] Einen reproduzierbaren Responsive-Check für Startseite und beide neue
  Kernseiten in sechs Viewports hinterlegen.
- [ ] Budgets festlegen, z. B. keine Regression bei LCP/INP/CLS und
  Informationsseiten ohne schwere Spielinitialisierung.

**Fertig, wenn:** Messwerte dokumentiert sind, P0-Probleme behoben wurden und
ein reproduzierbarer Check existiert.

### Arbeitspaket 8: E-E-A-T und Markenentität stärken

**Ziel:** Für Nutzer und Systeme ist eindeutig, wer hinter Punktlandung steht,
wie das Spiel gepflegt wird und warum Aussagen vertrauenswürdig sind.

- [ ] Über-/Projektseite mit Betreiber, Motivation, Kontaktweg und
  redaktioneller Verantwortung erstellen.
- [ ] Transparente Hinweise zu Beta-Status, Kosten, Anmeldung, Werbung,
  Datenquellen und Grenzen konsistent halten.
- [ ] Änderungsverlauf oder „Was ist neu?“ für wesentliche Produktänderungen
  einführen.
- [ ] `Organization`- oder `Person`-Schema erst ergänzen, wenn öffentliche,
  konsistente Betreiberangaben und URLs feststehen.
- [ ] Externe offizielle Profile über `sameAs` nur verknüpfen, wenn sie
  tatsächlich gepflegt werden.
- [ ] Fehler- und Feedbackweg gut sichtbar halten und echte Korrekturen
  nachvollziehbar machen.

**Fertig, wenn:** Betreiber, Produktstatus, Quellen und Kontakt konsistent und
prüfbar sind.

### Arbeitspaket 9: Reale Drittplattform-Präsenz

**Ziel:** Punktlandung wird außerhalb der eigenen Domain unabhängig erwähnt.

- [ ] Kurzen Gameplay-Trailer auf YouTube veröffentlichen, mit Link auf die
  passende Spiel-/Erklärseite.
- [ ] Zwei bis drei passende Kontexte priorisieren:
  deutschsprachige Browsergames, Geografie/Quiz, Spieleabend oder Unterricht.
- [ ] Redaktionen, Lehrkräfte, Quiz-/Spiele-Communities und Podcasts mit einem
  konkreten, relevanten Anlass ansprechen.
- [ ] Ein kleines Presse-/Creator-Kit bereitstellen:
  Kurzbeschreibung, Faktenblatt, Screenshots, Logo, Kontakt und Nutzungsrechte.
- [ ] Authentische Bewertungen nach echter Nutzung erbitten; keine gekauften
  Links oder erfundenen Rezensionen.
- [ ] Erwähnungen, Links, Videos und Bewertungen in einer Outreach-Liste mit
  Datum und Zielseite dokumentieren.

**Fertig, wenn:** Mindestens fünf relevante, echte Erwähnungen auf mehreren
unabhängigen Domains/Plattformen bestehen.

### Arbeitspaket 10: Direkten Nutzerkanal aufbauen

**Ziel:** Wiederkehrende Nutzung hängt nicht allein von Suchmaschinen ab.

- [ ] Zuerst den leichtesten Kanal wählen: opt-in Update-E-Mail oder ein klar
  benanntes Community-Profil.
- [ ] Nutzen des Kanals konkret machen, z. B. neue Kategorien, Spielmodi oder
  monatliche Geo-Challenge.
- [ ] Double-Opt-in, Abmeldung, Datenschutzhinweise und Auftragsverarbeitung vor
  Newsletter-Start klären.
- [ ] Keine aggressive Unterbrechung des ersten Spielstarts.
- [ ] Anmeldungen und wiederkehrende Besuche als eigene Conversion messen.

**Fertig, wenn:** Ein rechtlich sauberer Kanal aktiv ist und monatlich einen
echten Mehrwert liefert.

### Arbeitspaket 11: Monatlicher SEO-/GEO-Zyklus

**Ziel:** Sichtbarkeit wird fortlaufend überprüft, nicht einmalig „optimiert“.

- [ ] Feste Liste von 10 bis 15 Zielanfragen pflegen.
- [ ] Monatlich Google-/Bing-Daten, AI-Referrals und Produkt-Conversions
  vergleichen.
- [ ] Dieselben neutral formulierten Fragen in ChatGPT, Perplexity, Claude und
  Gemini prüfen.
- [ ] Pro Antwort dokumentieren: Wird Punktlandung genannt? Welche Quellen
  werden zitiert? Sind Aussagen korrekt? Welche Wettbewerber erscheinen?
- [ ] Standort, Sprache, Datum und angemeldeten/abgemeldeten Testzustand
  protokollieren, weil Antworten variieren.
- [ ] Änderungen mit Deployment-Datum markieren und erst nach ausreichend Zeit
  bewerten.
- [ ] Quartalsweise dünne Inhalte löschen, bündeln oder substanziell verbessern.

**Beispielanfragen**

1. Was ist eine kostenlose GeoGuessr-Alternative auf Deutsch?
2. Welches Geografie-Spiel kann man ohne Anmeldung im Browser spielen?
3. Welches Geo-Quiz eignet sich für einen Spieleabend?
4. Wie funktioniert die Punktevergabe bei einem Orte-Erraten-Spiel?
5. Welche deutschsprachigen Spiele gibt es zum Erraten von Orten?

**Kern-KPIs**

- organische Impressionen, Klicks und CTR für nicht-markenbezogene Anfragen
- Anzahl der Zielanfragen in den organischen Top 20
- indexierte, fehlerfreie Kernseiten
- AI-Referral-Sitzungen und deren Spielstart-/Abschlussrate
- dokumentierte korrekte Markennennungen in KI-Antworten
- relevante externe Markenerwähnungen und verweisende Domains
- Anteil gestarteter zu abgeschlossenen Spiele
- direkte bzw. wiederkehrende Nutzer

## Empfohlene Umsetzung in sechs Etappen

### Etappe 1 – Fundament und Baseline

Arbeitspakete 1 bis 3 vollständig umsetzen. Noch keine größere Content-Welle
starten, bevor Produktions-URLs, Indexierung und Ausgangsdaten stimmen.

### Etappe 2 – Zitierbare Kerninhalte

Arbeitspaket 4 umsetzen und anschließend die zwei priorisierten eigenen Inhalte
aus Arbeitspaket 5 veröffentlichen.

### Etappe 3 – Bestehende Seiten bereinigen

Mit ersten Search-Console-Daten Arbeitspaket 6 durchführen. Qualität und klare
Intention gehen vor Seitenanzahl.

### Etappe 4 – Technik und Vertrauen

Arbeitspakete 7 und 8 umsetzen: Performance, Zugänglichkeit, Betreiber- und
Quellentransparenz.

### Etappe 5 – Autorität außerhalb der Website

Arbeitspaket 9 starten. Der Trailer und das Faktenblatt liefern dafür die ersten
konkreten Assets.

### Etappe 6 – Unabhängigkeit und Lernzyklus

Arbeitspakete 10 und 11 etablieren. Monatlich nur wenige, anhand der Daten
begründete Änderungen umsetzen.

## Was wir bewusst nicht tun

- keine massenhaft generierten Ratgeber oder Ortsseiten
- keine künstliche Keyword-Wiederholung oder versteckten SEO-Texte
- keine erfundenen Autoren, Bewertungen, Statistiken oder Aktualitätsdaten
- keine gekauften Links
- keine FAQ nur für Markup
- keine speziellen „KI-Dateien“ als vermeintlichen Ranking-Trick
- keine Erfolgsmessung allein anhand einzelner, schwankender Chatbot-Antworten

## Nächster konkreter Schritt

Wir beginnen mit **Etappe 1 / Arbeitspaket 1**:

1. produktive Hauptdomain bestätigen,
2. Live-Canonicals, Sitemap und robots.txt abrufen,
3. indexierbare und nicht indexierbare Routen festlegen,
4. Sitemap-Aktualitätslogik korrigieren,
5. Ergebnisse als kurze technische Abnahme dokumentieren.
