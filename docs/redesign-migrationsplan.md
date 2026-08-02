# Punktlandung: technischer Redesign-Migrationsplan

Stand: 2. August 2026

## Ziel

Das neue Erscheinungsbild wird schrittweise auf die vorhandene Anwendung übertragen. Spielregeln, Datenmodell, Online-Protokoll, lokale Sitzungen, Werbung, rechtliche Inhalte und SEO-Routen bleiben während der Migration funktionsfähig. Konto, Google-Login, Streaks und Challenges sind ausdrücklich keine Voraussetzung für das Redesign.

## Unverrückbare Leitplanken

- Alle vorhandenen Funktionen bleiben erhalten.
- Desktop, Laptop, Monitor und TV bleiben – außer auf Inhaltsseiten – Single-Screen-Ansichten.
- Die drei Phone-Viewports dürfen vertikal scrollen.
- Die sechs verbindlichen Viewports sind 360 × 800, 430 × 932, 932 × 430, 1366 × 768, 1920 × 1080 und 3840 × 2160.
- Spieler 1 ist rot, Spieler 2 blau; weitere Spieler behalten eine stabile Palette.
- Anzeigenplätze, Kartenattributionen, Bildquellen und Rechtstexte werden nicht verkürzt oder entfernt.
- Änderungen am Zustand in `useLocalGame`, an `RoomState` oder am WebSocket-Protokoll erfolgen nicht zusammen mit rein visuellen Änderungen.
- Jede Seite wird nach der Migration einzeln freigegeben, bevor die nächste vertikale Scheibe beginnt.

## UX-Zielzustand

### Bereits im Redesign vorgesehen

- „Direkt spielen“ startet unmittelbar eine Solo-Partie mit Smart Defaults.
- Einstellungen bleiben als bewusster zweiter Einstieg erreichbar.
- Standardwerte: Kategorie Gemischt, 60 Sekunden, 15 Runden, Schwierigkeit Mittel.
- Online-Raum erstellen und beitreten sind innerhalb des Online-Modus gebündelt.
- Spielen bleibt ohne Anmeldung möglich.
- Ergebnisse zeigen Punkte im Verhältnis zur Maximalpunktzahl, Entfernung, Rundenrang und Gesamtrang.
- Das Endergebnis zeigt Finaltabelle, Punktebalken und ausgewählte Bestwerte.
- Nach dem Endergebnis wird ein ruhiger, nicht blockierender Einstieg „Ergebnis sichern“ angeboten.

### Erst nach dem stabilen Redesign

- Kontosystem und Google-Login
- geräteübergreifende Ergebnisspeicherung
- Profil, Avatar und Lieblingsregion
- Challenges und Daily Challenges
- Streaks und Fortschrittssysteme
- Verlusthinweise, sofern sie auf real vorhandenen und fair erklärten Spielständen beruhen

## Migrationsreihenfolge

### 0. Baseline und Sicherung

1. Aktuellen Arbeitsstand sichern, ohne das Arbeitsverzeichnis zu verändern.
2. Vor Beginn der Umsetzung entscheiden, ob die vorhandenen Änderungen in `main` als eigener fachlicher Commit abgeschlossen werden.
3. Danach einen Redesign-Branch mit Präfix `codex/` vom freigegebenen Stand anlegen.
4. Baseline ausführen:
   - `npm run typecheck`
   - `npm run build:check`
   - `npm run test:ws-hardening`
   - `npm run check:responsive`
5. Vorher-Nachher-Screenshots der sechs Viewports aufbewahren.

Abnahmekriterium: Der Ausgangsstand ist reproduzierbar und bekannte Fehler sind dokumentiert.

### 1. Designfundament ohne Seitenumbau

1. Zentrale Tokens für Farben, Abstände, Radien, Konturen, Schatten und Typografie in einer klar abgegrenzten Redesign-Schicht anlegen.
2. Wiederverwendbare Primitives erstellen oder bestehende Komponenten erweitern:
   - Primary-, Secondary-, Quiet- und Text-Button
   - Auswahlsegment und Optionsgruppe
   - Karten- und Inhaltsfläche
   - Spieleravatar und Spielerfarbpalette
   - Punktebalken von Violett über Blau zu Mint
   - Header, Footer und Anzeigenrahmen
3. Grid und bewegte Farbverläufe zentral an die App-Shell binden.
4. Bewegungen mit `prefers-reduced-motion` absichern.

Abnahmekriterium: Die neuen Bausteine sind isoliert nutzbar, ohne bestehende Seiten zu verändern.

### 2. Startseite und Spieleinstellungen

Betroffene Dateien beginnen voraussichtlich bei `components/GameApp.tsx`, `components/LobbyView.tsx`, `components/Button.tsx` und `app/globals.css`.

1. Neue App-Shell und Startseite übertragen.
2. „Direkt spielen“ technisch auf Solo plus Smart Defaults abbilden.
3. Moduswahl Solo, Party und Online als Segmente umsetzen.
4. Zeit, Runden, Schwierigkeit und Einschränkungen als einheitliche Auswahlfelder migrieren.
5. Partyanzahl 2–10 und Namensbearbeitung erhalten.
6. Host-Rolle als „Spielt mit“ oder „Moderiert“ erhalten.
7. Kategorien und kommende Kategorien vollständig abbilden.
8. Anzeigen und Footer an den vorgesehenen Positionen erhalten.

Abnahmekriterium: Solo-, Party- und Online-Konfiguration erzeugen exakt dieselben `GameSettings` wie zuvor.

### 3. Online-Warteraum

1. QR-Code, Raumcode, Kopieren und Teilen in das neue Ein-Drittel-/Zwei-Drittel-Raster übertragen.
2. Spielerliste, Bereitschaft, Team, Host-Rolle und Startberechtigung erhalten.
3. Online-Zustände „verbindet“, „verbunden“, „offline“ und Fehlerzustände prüfen.
4. WebSocket-Nachrichten und Serverlogik unverändert lassen, sofern kein separater Fehler behoben wird.

Abnahmekriterium: Erstellen, Beitreten, Wiederverbinden, Starten und Verlassen funktionieren lokal und über den Raumserver.

### 4. Spielseite und „Bild nochmal ansehen“

Betroffene Komponenten beginnen voraussichtlich bei `components/GameView.tsx`, `components/GuessMap.tsx`, `components/LeafletMap.tsx`, `components/PanoramaViewer.tsx` und `components/AdContainer.tsx`.

1. Spielbild als dominante Fläche übertragen.
2. Runde, Zeit, Aufgabe und Zurück-Aktion lesbar über dem Bild halten.
3. Werberechteck links unten, Quelle mittig und eingeklappte Karte rechts unten erhalten.
4. Maximieren/Minimieren als einen zustandsabhängigen Button erhalten.
5. „Bild frei“ mit korrekter Geometrie und Leserichtung übertragen.
6. Wiederansicht visuell mit der Spielansicht synchronisieren.
7. In der Wiederansicht Tipp-, Ziel-Pins und animierte Verbindung anzeigen, aber keine neue Tippabgabe erlauben.

Abnahmekriterium: Karte, Pin, Abgabe, Timer, Panorama, Einschränkungen und Wiederansicht verhalten sich wie im Ausgangsstand.

### 5. Auflösung

Betroffene Komponenten beginnen voraussichtlich bei `components/ResultsView.tsx` und `components/LeafletMap.tsx`.

1. Ranglistenblock links und Karte rechts im Ein-Drittel-/Zwei-Drittel-Raster übertragen.
2. Rundenrang und Gesamtrang vollständig erhalten.
3. Punktebalken proportional zur Maximalpunktzahl darstellen.
4. Verbindungslinie außerhalb der Spielerellipse beginnen und vor der Zielellipse enden lassen.
5. Aktionen „Zurück“, „Bild nochmal ansehen“ und „Nächste Runde“ erhalten.

Abnahmekriterium: Punkte, Entfernung, Reihenfolge, Karten-Pins und Navigation stimmen mit dem Spielzustand überein.

### 6. Endergebnis

1. Ergebnis-Header und Inhalt auf dasselbe 60/40-Raster legen.
2. Finaltabelle mit bis zu zehn Spielern und stabilen Farben übertragen.
3. Kurzstatistiken und proportionale Punktebalken ohne Abschneiden darstellen.
4. Bestwerte erhalten: meiste Punktlandungen, beste Einzelrunde, schnellster Tipp und bester Entfernungsschnitt.
5. Startseite, Teilen und Nochmal spielen erhalten.
6. Nicht blockierenden „Ergebnis sichern“-Einstieg als vorbereiteten UI-Zustand einbauen; ohne Kontobackend zunächst klar als noch nicht verfügbare Funktion behandeln oder hinter einem Feature-Flag ausblenden.

Abnahmekriterium: Ein bis zehn Spieler, Gleichstände, fehlende Tipps und alle Kategorien erzeugen korrekte Statistiken.

### 7. Info-, Rechts- und SEO-Seiten

1. `InfoPageShell`, `SeoLandingPage`, `SeoContent`, `ImportantPages`, `LegalLinks` und zugehörige Routen auf das neue Design übertragen.
2. Vollständige Inhalte aus Impressum, Datenschutz, Lizenzen, Cookies, FAQ und Feedback erhalten.
3. SEO-Seiten weiterhin nur über Infos und thematische Verlinkungen erschließen; nicht sämtlich in den globalen Footer aufnehmen.
4. Metadaten, strukturierte Daten, Sitemap und Canonicals unverändert prüfen.
5. Lange Inhaltsseiten dürfen scrollen.

Abnahmekriterium: Alle Routen aus `lib/seo.ts` sind erreichbar, indexierbar und inhaltlich vollständig.

## Prüfmatrix je Migrationsschritt

Für jede betroffene Seite werden geprüft:

- sechs Viewportgrößen
- kein horizontaler Overflow
- Single-Screen-Vorgabe auf Laptop, Monitor und TV
- Tastaturfokus und Bedienbarkeit
- Hover-, Active-, Disabled- und Loading-Zustände
- reduzierte Bewegung
- Spielerfarben und Kontrast
- Anzeigenpositionen
- Karten- und Bildattribution
- Footer- und Rechtlinks
- Rückwärts- und Vorwärtsnavigation
- Wiederherstellung der lokalen Sitzung
- relevante Analytics-Ereignisse

## Commit-Strategie

Jede vertikale Scheibe erhält einen eigenen Commit. Visuelle Änderungen und Zustands-/Protokolländerungen werden nicht im selben Commit vermischt. Empfohlene Reihenfolge:

1. `redesign: add tokens and primitives`
2. `redesign: migrate home and setup`
3. `redesign: migrate online waiting room`
4. `redesign: migrate game and replay`
5. `redesign: migrate round results`
6. `redesign: migrate final results`
7. `redesign: migrate info legal and seo pages`
8. `redesign: complete responsive regression pass`

## Unmittelbar nächster Umsetzungsschritt

Vor dem ersten Redesign-Commit werden die derzeitigen fachlichen Änderungen im Arbeitsverzeichnis geprüft und separat abgeschlossen. Anschließend beginnt Phase 1 ausschließlich mit Design-Tokens und wiederverwendbaren Primitives. Die Startseite wird erst danach als erste vertikale Scheibe migriert.
