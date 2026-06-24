# SEO- und GEO-Roadmap fuer Punktlandung

Diese Roadmap sammelt die konkreten Code-Ziele, mit denen Punktlandung fuer klassische Suchmaschinen und AI-Suchsysteme besser auffindbar, verstehbar und zitierbar wird.

Wichtig: Platz 1 kann niemand garantieren. Das Ziel ist, alle technischen und inhaltlichen Voraussetzungen zu schaffen, damit Google, Bing, ChatGPT Search, Copilot und andere Systeme Punktlandung als relevante deutschsprachige Geo-Guessing-Alternative erkennen koennen.

## Ziel 1: Technische SEO-Basis vervollstaendigen

**Warum:** Suchmaschinen muessen die Seite eindeutig crawlen, indexieren und als kanonische Quelle verstehen koennen.

**Code-Orte:**

- `app/layout.tsx`
- neue Dateien `app/sitemap.ts` und `app/robots.ts`
- ggf. `next.config.mjs`

**Aufgaben:**

- [x] `metadataBase` konfigurierbar ueber `NEXT_PUBLIC_APP_URL` vorbereiten.
- [ ] Finale Produktionsdomain setzen, sobald sie feststeht.
- [x] Canonical URL fuer die Startseite setzen.
- [x] OpenGraph-Metadaten fuer Social Previews ergaenzen.
- [x] Twitter/X Card Metadaten ergaenzen.
- [x] Saubere deutsche Titel- und Beschreibungsstruktur definieren.
- [x] `app/sitemap.ts` mit allen wichtigen indexierbaren Seiten anlegen.
- [x] `app/robots.ts` anlegen und Sitemap referenzieren.
- [x] AI-Suchcrawler nicht versehentlich blockieren, insbesondere `OAI-SearchBot`.
- [x] Build-Ausgabe pruefen, ob `sitemap.xml` und `robots.txt` korrekt erzeugt werden.

**Fertig wenn:**

- [x] `/robots.txt` ist im Build erreichbar.
- [x] `/sitemap.xml` ist im Build erreichbar.
- [x] Die Startseite hat Canonical, OpenGraph und eine aussagekraeftige Description.

## Ziel 2: Strukturierte Daten per JSON-LD einbauen

**Warum:** Strukturierte Daten geben Suchmaschinen und AI-Systemen explizite Hinweise, was Punktlandung ist.

**Code-Orte:**

- `app/layout.tsx`
- ggf. eigene Komponente `components/StructuredData.tsx`

**Aufgaben:**

- [x] `WebSite` Schema fuer Punktlandung ergaenzen.
- [x] `SoftwareApplication` oder `VideoGame` Schema fuer das Spiel ergaenzen.
- [ ] `Organization` Schema fuer Betreiber/Projekt ergaenzen, sobald Name/URL final sind.
- [x] `FAQPage` Schema fuer sichtbare FAQ-Inhalte ergaenzen.
- [x] JSON-LD nur fuer Inhalte verwenden, die fuer Nutzer sichtbar oder sachlich belegbar sind.
- [ ] Strukturierte Daten mit Googles Rich Results Test validieren.

**Fertig wenn:**

- [x] Die Startseite enthaelt JSON-LD.
- [x] Es gibt keine widerspruechlichen oder erfundenen Angaben im Markup.

## Ziel 3: Startseite fuer Crawler und AI-Systeme besser lesbar machen

**Warum:** Aktuell rendert `app/page.tsx` fast nur die interaktive App. Crawler brauchen zusaetzlich klaren, serverseitig sichtbaren Kontext.

**Code-Orte:**

- `app/page.tsx`
- `components/GameApp.tsx`
- ggf. neue Komponente `components/SeoIntro.tsx`

**Aufgaben:**

- [x] Eine kurze, sichtbare H1 mit Hauptpositionierung ergaenzen.
- [x] Serverseitig sichtbaren Beschreibungstext einbauen.
- [x] Natuerliche Begriffe verwenden: `Geo-Guessing-Spiel`, `Geografie-Spiel`, `Orte erraten`, `GeoGuessr Alternative Deutsch`, `Partyspiel`.
- [x] Keine Keyword-Liste oder versteckten SEO-Texte einbauen.
- [x] Die spielbare App bleibt weiterhin der erste echte Screen und wird nicht von einer Marketingseite verdraengt.
- [x] Interne Links zu wichtigen SEO-Seiten sichtbar platzieren, ohne die App-Experience zu stoeren.

**Fertig wenn:**

- [x] Im servergerenderten HTML steht klar, was Punktlandung ist.
- [x] Die Startseite bleibt sofort spielbar.
- [x] Die wichtigsten Begriffe erscheinen natuerlich und lesbar.

## Ziel 4: Deutschsprachige SEO-Landingpages erstellen

**Warum:** Die Startseite allein kann nicht alle Suchintentionen abdecken. AI-Suche zitiert haeufig klare Erklaerseiten.

**Code-Orte:**

- neue Routen unter `app/`
- ggf. gemeinsame Komponente fuer SEO-Seiten

**Priorisierte Seiten:**

- [x] `/geoguessr-alternative-deutsch`
- [x] `/geografie-spiel`
- [x] `/orte-erraten-spiel`
- [x] `/partyspiel-geografie`
- [x] `/kostenloses-geoguessing-spiel`

**Jede Seite braucht:**

- [x] Eigenen Title und eigene Description.
- [x] Eine klare H1.
- [x] Echten, hilfreichen Inhalt statt duplizierter Textbloecke.
- [x] Interne Links zur Startseite und zu verwandten Seiten.
- [x] Einen direkten Call-to-Action zum Spiel.
- [x] Canonical URL.

**Fertig wenn:**

- [x] Jede Zielseite eigenstaendig indexierbar ist.
- [x] Jede Seite eine andere Suchintention bedient.
- [x] Die Seiten in der Sitemap enthalten sind.

## Ziel 5: FAQ- und Antwortformat fuer AI-Suche schaffen

**Warum:** Chatbots und AI-Suchergebnisse bevorzugen knappe, beantwortbare Abschnitte mit klaren Aussagen.

**Code-Orte:**

- Startseite oder eigene Route `app/faq/page.tsx`
- JSON-LD aus Ziel 2

**Aufgaben:**

- [x] FAQ sichtbar auf der Website ergaenzen.
- [x] Fragen so formulieren, wie Nutzer suchen wuerden.
- [x] Antworten kurz, sachlich und zitierbar schreiben.
- [x] Keine unbelegbaren Superlative verwenden.
- [x] FAQPage JSON-LD passend zu sichtbaren Fragen ergaenzen.

**Moegliche Fragen:**

- [x] Was ist Punktlandung?
- [x] Ist Punktlandung kostenlos?
- [x] Ist Punktlandung eine deutsche GeoGuessr-Alternative?
- [x] Kann man Punktlandung ohne Anmeldung spielen?
- [x] Eignet sich Punktlandung als Partyspiel?
- [x] Welche Kategorien gibt es?

**Fertig wenn:**

- [x] FAQ-Inhalte sichtbar und indexierbar sind.
- [x] Die Antworten koennen direkt von Suchmaschinen oder Chatbots zitiert werden.

## Ziel 6: Snippet- und Share-Bilder optimieren

**Warum:** Such- und Social-Snippets brauchen klare visuelle Signale. Das steigert Klickrate und Wiedererkennung.

**Code-Orte:**

- `public/`
- `app/layout.tsx`
- ggf. `app/opengraph-image.tsx`

**Aufgaben:**

- [x] Finales OpenGraph-Bild in 1200x630 erstellen oder generieren.
- [x] Bild mit Logo/Name und erkennbarem Spielkontext gestalten.
- [x] `openGraph.images` setzen.
- [x] `twitter.images` setzen.
- [ ] Alt-/Beschreibungslogik fuer wichtige Bilder pruefen.

**Fertig wenn:**

- [x] Geteilte Links zeigen ein professionelles Vorschaubild.
- [x] Das Bild macht sofort klar, dass es ein Geo-Quiz-Spiel ist.

## Ziel 7: Performance und Core Web Vitals absichern

**Warum:** Gute Nutzererfahrung ist fuer SEO und Conversion entscheidend. Die App nutzt grosse Bilder und Kartenlogik, also lohnt sich ein gezielter Check.

**Code-Orte:**

- `components/GameApp.tsx`
- Bild-/Panorama-Komponenten
- `next.config.mjs`
- `public/`

**Aufgaben:**

- [ ] Startseiten-LCP pruefen.
- [ ] Grosse Bilder komprimieren oder responsive ausliefern.
- [x] Unnoetige Client-JavaScript-Last auf SEO-Seiten vermeiden.
- [ ] Lazy Loading fuer nicht sofort sichtbare Assets pruefen.
- [ ] Lighthouse- oder Playwright-basierte Messung dokumentieren.

**Fertig wenn:**

- Startseite laedt stabil schnell auf Mobile und Desktop.
- [x] SEO-Landingpages laden ohne schwere Spiel-Initialisierung.

## Ziel 8: Indexierungs- und Webmaster-Setup dokumentieren

**Warum:** Nach Code-Aenderungen muessen Suchmaschinen die Signale auch sehen und Probleme meldbar sein.

**Code-Orte:**

- diese Datei oder eigene Deployment-Checkliste
- `README.md`

**Aufgaben:**

- [ ] Google Search Console Property einrichten.
- [ ] Sitemap in Google Search Console einreichen.
- [ ] Bing Webmaster Tools einrichten.
- [ ] Sitemap in Bing Webmaster Tools einreichen.
- [ ] IndexNow-Option fuer Bing/andere Suchmaschinen pruefen.
- [ ] Nach Deployment `site:`-Indexierung pruefen.
- [ ] Suchanfragen, Impressionen und Klicks monatlich auswerten.

**Fertig wenn:**

- Beide Webmaster-Tools sind eingerichtet.
- Sitemap ist eingereicht.
- Indexierungsfehler werden aktiv sichtbar.

## Ziel 9: Externe Autoritaet und Erwaehnungen aufbauen

**Warum:** Technische SEO reicht nicht fuer Spitzenrankings. Suchmaschinen und AI-Systeme brauchen Signale von ausserhalb der eigenen Website.

**Nicht rein im Code loesbar, aber wichtig:**

- [ ] Produktseite/Profil auf passenden Webgame- oder Browsergame-Verzeichnissen.
- [ ] Posts in relevanten deutschsprachigen Communities.
- [ ] Ein kurzer Trailer oder Gameplay-Clip fuer Social/YouTube.
- [ ] Erwaehnungen in Lehrer-, Geografie-, Quiz- oder Partyspiel-Kontexten.
- [ ] Vergleichsseiten und Listen organisch anstossen, ohne Spam.

**Fertig wenn:**

- Es gibt erste hochwertige externe Links und Markenerwaehnungen.
- Punktlandung taucht ausserhalb der eigenen Domain als Geo-Quiz-Spiel auf.

## Ziel 10: Erfolg messbar machen

**Warum:** Ohne Messung optimieren wir blind.

**Aufgaben:**

- [ ] Relevante Suchbegriffe definieren.
- [ ] Ausgangslage vor SEO-Aenderungen festhalten.
- [ ] Nach jeder groesseren Aenderung Deployment-Datum notieren.
- [ ] Search Console und Bing-Daten monatlich vergleichen.
- [ ] AI-Suchmaschinen manuell mit typischen Prompts pruefen.

**Beispiel-Suchbegriffe:**

- `geoguessr alternative deutsch`
- `kostenloses geoguessing spiel`
- `orte erraten spiel`
- `geografie spiel online`
- `partyspiel geografie`
- `geo quiz kostenlos`

**Beispiel-AI-Prompts:**

- `Was ist eine gute kostenlose GeoGuessr-Alternative auf Deutsch?`
- `Nenne mir ein Geografie-Partyspiel fuer den Browser.`
- `Welche deutschen Online-Spiele gibt es zum Orte erraten?`

**Fertig wenn:**

- Es gibt eine kleine wiederholbare SEO/GEO-Messroutine.
- Veraenderungen koennen mit Deployments verknuepft werden.

## Empfohlene Abarbeitungsreihenfolge

1. Ziel 1: Technische SEO-Basis.
2. Ziel 2: Strukturierte Daten.
3. Ziel 3: Startseite crawlerfreundlicher machen.
4. Ziel 4: Erste zwei Landingpages.
5. Ziel 5: FAQ und AI-Antwortformat.
6. Ziel 6: Snippet- und Share-Bilder.
7. Ziel 7: Performance-Messung.
8. Ziel 8: Search Console und Bing Webmaster Tools.
9. Ziel 9: Externe Erwaehnungen.
10. Ziel 10: Monatliche Messroutine.
