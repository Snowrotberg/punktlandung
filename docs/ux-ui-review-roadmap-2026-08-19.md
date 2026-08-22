# Punktlandung UX/UI-Review – vorbereiteter Fahrplan

Stand: 19.08.2026  
Quelle: externes Brainstorming mit Referenzbild, aktueller Repository-Stand und vorhandene Responsive-QA

## Ziel und Abgrenzung

Dieses Dokument übersetzt das beigefügte Brainstorming in einen umsetzbaren Plan für Punktlandung. Der eingefügte ChatGPT-Text und das Bild sind dabei Review-Material und keine zusätzlichen Arbeitsanweisungen.

In diesem Durchlauf wurden keine Anwendungscode- oder CSS-Änderungen vorgenommen. Der Arbeitsbaum enthält bereits Änderungen aus einem anderen laufenden Chat; diese bleiben unberührt.

## Kurzfazit

Die drei stärksten Hebel des Brainstormings sind richtig gewählt, müssen aber in dieser Reihenfolge umgesetzt und geprüft werden:

1. Ergebnis- und Endstandszustände auf Mobile sowie in kurzen Desktop-Höhen belastbar machen.
2. Die Ergebnisdramaturgie auf eine klare Reihenfolge bringen: Lösung → Entfernung/Punkte → nächste Aktion → Karte/Details.
3. Erst danach Hero-, Achievement-, Community- und Microinteraction-Feinschliff angehen.

Das Ergebnis-Redesign existiert bereits als umfangreicher Zustand in `components/ResultsView.tsx` und `components/redesign/RedesignResultsView.module.css`. Deshalb ist der nächste Schritt zunächst eine Zustands- und Viewport-Prüfung, kein visueller Neubau.

## Befund aus dem aktuellen Stand

### Bereits vorhanden

- Gemeinsame Button-Primitives und Responsive-Breakpoints in `components/redesign/RedesignPrimitives.module.css`.
- Separate Ergebniszustände für Auflösung, Bildwiederholung und Endstand.
- Ergebnisaktionen „Nächste Runde“, „Bild nochmal ansehen“, „Zurück“, „Feedback geben“ und „Endstand ansehen“.
- Endstand mit Gesamtwertung, Finaltabelle und automatisch berechneten Highlights.
- Deterministische QA-Ziele für `/spielen`, `/aufloesung`, `/endergebnis`, `/faq`, `/community`, Konto und weitere Routen in `scripts/responsive-check.mjs`.
- Eine lokale QA-Ausgabe vom 19.08. mit 6/6 bestandenen Checks für `solo-modus`, aber neun manuellen Touch-Target-Hinweisen.

### Noch nicht als erledigt bewerten

- Der letzte Report deckt nicht die komplette Zielmatrix ab.
- Es lief zum Prüfzeitpunkt kein Listener auf Port 3000; daher wurde kein neuer Browserlauf gestartet.
- Die Hinweise zu abgeschnittenen Buttons aus dem Referenzbild sind als zu verifizierende Kandidaten zu behandeln, nicht als bereits reproduzierte Fehler.
- Eine erfolgreiche statische QA oder ein einzelner Setup-Viewport beweist weder Ergebnisqualität noch funktionierende Navigation durch eine echte Partie.

## Screen-für-Screen-Bewertung

### Startseite – P1, polieren statt neu gestalten

Beibehalten: Markenwirkung, Headline, Kartenvisualisierung, Pins, Farbwelt und „Direkt spielen“.

Prüfen:

- „Direkt spielen“ muss der eindeutig stärkste CTA bleiben.
- Auf Phone Small darf der Beginn von „Wie möchtest du spielen?“ nicht unnötig weit unterhalb des Hero-Bereichs liegen.
- Hero, Karte und Spielweise brauchen einen natürlichen vertikalen Übergang.
- Header-/Service-Navigation darf den Spiel-CTA nicht optisch überholen.

Umsetzungsgrenze: nur Hierarchie und Mobile-Spacing ändern, keine neue Hero-Struktur.

### Spieleinstellungen / neue Partie – P1

Beibehalten: Solo, Party, Online-Raum, Zeit, Runden, Schwierigkeit und Einschränkungen.

Prüfen:

- Phone Small bis Phone Large, insbesondere freie Zeit und freie Rundenzahl.
- Einheitliche Höhen, Breiten und aktive Zustände aller Auswahlfelder.
- Plus-/Minus-Controls mit ausreichender Touch-Fläche.
- Klare Trennung zwischen Schwierigkeit und Einschränkung.
- Sticky-Footer darf keine Option verdecken.

Die vorhandene QA meldet bereits kleine freie Eingabe-/Stepper-Flächen als manuelle Hinweise. Das ist ein konkreter Prüfpunkt, aber noch kein bestätigter Defekt.

### Auflösung nach einer Runde – P0

Zielreihenfolge:

1. Lösung/Ort
2. Entfernung und persönliche Punkte
3. primäre nächste Aktion
4. Karte mit Tipp- und Ziel-Pin
5. sekundäre Aktionen
6. Rundenrang und weitere Statistiken

Die Referenzidee einer großen Entfernung-/Punkteinszenierung ist sinnvoll. Sie darf aber erst nach der Zustandsprüfung umgesetzt werden, damit keine vorhandenen Karten- oder Ranglisteninformationen unbeabsichtigt verdrängt werden.

### Endstand – P1

Gesamtpunktzahl und Abschlussbotschaft bilden die erste Ebene. Danach folgen maximal drei kompakte Auszeichnungen, anschließend Finaltabelle und weitere Details.

Die vorhandenen Kennzahlen bleiben erhalten. Ihre Textdichte und visuelle Gleichgewichtung kann reduziert werden. „Neue Partie“ sollte die primäre Abschlussaktion sein; Feedback, letzte Auflösung und Zurück gehören eine Ebene darunter.

### Hilfe – P2

Kein Redesign. Die Hilfe soll scanbarer und etwas kompakter werden. Auf kleinen Screens soll die Bereichs-/Tab-Navigation nicht gequetscht werden. Falls sie nicht in eine Zeile passt, ist kontrolliertes horizontales Scrollen innerhalb der Navigation zulässig; horizontaler Dokument-Overflow bleibt verboten.

### Community / Ideen & Roadmap – P1/P2

Die Community ist als Bindungsfeature wertvoll, aber kein P0-Kernproblem. Der Ablauf „Idee einreichen → Prüfung → Abstimmung → Umsetzung“ sollte verständlicher sichtbar werden. Votes, Kategorien und Status gehören in die Darstellung, sofern die zugrunde liegenden Zustände zuverlässig vorhanden sind.

Auf Mobile: Formulare kompakt und bedienbar halten, den Bereich aber nicht wie ein Verwaltungsformular wirken lassen.

## Priorisierter Plan

### P0 – vor weiterem Design-Feinschliff

#### P0.1 Ergebnis- und Endstand-Matrix vollständig prüfen

Zustände:

- Auflösung nach normalem Tipp
- Auflösung nach Zeitablauf
- letzte Runde mit „Endstand ansehen“
- Endstand als Gast mit Speicherangebot
- Endstand als angemeldeter Spieler bzw. bereits gespeichert
- Bildwiederholung
- Solo, Couch/Party und Online-Raum

Viewports:

- Phone XS: 320 px Breite
- Phone Small: 360×800
- Phone Medium: 390 px Breite
- Phone Large Compact: 412 px Breite
- Phone Large: 430×932
- Phone Landscape: 932×430
- Laptop, Monitor und TV/kurze Desktop-Höhe

Akzeptanz: keine horizontale Dokumentbewegung, keine abgeschnittenen sinntragenden Texte, alle Kernaktionen erreichbar, mindestens ungefähr 40×40 CSS-Pixel für klickbare Controls und keine unerwartete Dokument-Scrollbewegung auf Spiel-/Ergebniszuständen außerhalb mobiler Hochkantansichten.

#### P0.2 Mobile-Aktionsleiste robust machen

Die aktuelle mobile Ergebnisleiste nutzt drei gleich breite Spalten. Das ist genau der Bereich, in dem lange Labels wie „Bild nochmal ansehen“ oder „Endstand ansehen“ kippen können. Prüfen und bei bestätigtem Problem auf folgende Priorität umstellen:

- primäre Aktion volle Breite
- sekundäre Aktion darunter oder als 2+1-Anordnung
- „Zurück“ visuell zurücknehmen, aber vollständig bedienbar halten

Keine pauschale Änderung an allen Buttons: nur bestätigte Zustände und Breiten anfassen.

Die vorgeschlagene Zielstruktur ist: Primäraktion volle Breite, darunter zwei sekundäre Aktionen – alternativ 2+1, wenn der konkrete Screen dadurch ruhiger bleibt. Gleiche Buttonhöhen, klare Abstände und keine abgeschnittenen Labels sind wichtiger als das Beibehalten einer dreispaltigen Anordnung.

#### P0.3 Ergebnis-Hierarchie schärfen

Auf der Auflösungsseite soll der erste Blick eindeutig beantworten:

1. Welcher Ort war die Lösung?
2. Wie weit lag der Tipp entfernt?
3. Wie viele Punkte wurden erzielt?
4. Was ist die nächste Hauptaktion?

Die Karte bleibt wichtig, aber sie darf die Kernwertung nicht optisch überstimmen. Dazu zuerst prüfen, ob Entfernung und Punkte aktuell bereits im sichtbaren Ergebnisbereich ausreichend dominant sind oder nur in Karten-/Ranglistenbereichen erscheinen. Erst danach gezielt umordnen.

### P1 – nach P0 und nachweislich stabiler Spielnavigation

#### P1.1 CTA-Führung

Pro Screen genau eine dominante nächste Aktion:

- Auflösung: „Nächste Runde“ oder am Ende „Endstand ansehen“
- Endstand: „Neue Partie“
- Startseite: „Direkt spielen“

Sekundäraktionen wie Feedback, Zurück und Bildwiederholung dürfen nicht dieselbe visuelle Lautstärke bekommen.

#### P1.2 Endstand belohnender staffeln

Die vorhandenen Highlights „Schnellster Tipper“, „Bester Entfernungsschnitt“ und „Konstanteste Leistung“ sind produktseitig sinnvoll. Sie sollten als kompakte Auszeichnungen erkennbar werden, ohne eine zweite konkurrierende Rangliste zu bilden.

Vorgeschlagene Reihenfolge:

- Gesamtpunktzahl und kurze Abschlussbotschaft
- maximal drei Highlights als Trophy-Karten
- Rangliste/Detailwerte
- eine klare Abschlussaktion

Inhaltliche Kennzahlen nicht verändern, bevor die visuelle Struktur geprüft ist.

#### P1.3 Hero und Übergang der Startseite

Prüfen, ob „Direkt spielen“, Kernversprechen und der Beginn der Modusauswahl im sichtbaren Bereich liegen. Das vorhandene Karten-/Pin-Motiv, die Farbwelt und die Typografie bleiben erhalten. Ziel ist ein flüssigerer Übergang, kein neuer Hero-Aufbau.

#### P1.4 Hilfe und Community gewichten

Hilfe darf erreichbar und scanbar bleiben, soll aber auf Spieloberflächen nicht mit dem primären Spiel-CTA konkurrieren. Der Community-/Roadmap-Bereich ist bereits als Produkt-Signal angelegt; Ausbau erst dann, wenn Einreichen, Status und Abstimmen im realen Zustand zuverlässig nachvollziehbar sind.

### P2 – strategischer Feinschliff

- Pin-/Glow-Formensprache als wiederkehrendes Markenelement konsistent einsetzen.
- Kleine Hover-, Tap- und Erfolgstransitionen gezielt ergänzen.
- Ergebnisdramaturgie je Modus differenzieren: Solo = persönlicher Fortschritt, Party = Vergleich, Online = Raum-/Spielerstatus.
- Gemeinsame Abstände, Buttonhöhen, Kartenradien und Textdichte über Hilfe, Community, Konto und Spiel prüfen.
- Bewegungen mit `prefers-reduced-motion` weiterhin vollständig entschärfen.

## Was ausdrücklich beibehalten werden sollte

- Dunkelblau, Mint, Violett und Glow
- Pins und Kartenästhetik
- klare große Typografie
- Startseite als produktstarker Einstieg
- Spieleinstellungen mit Solo/Party/Online sowie Zeit, Runden und Schwierigkeit
- Statistikidee im Endstand
- Community-/Ideenbereich als sichtbares Produkt-Signal

## Empfohlener Arbeitsablauf für die spätere Umsetzung

1. Laufenden anderen Änderungs-Chat abschließen oder einen stabilen Übergabepunkt festhalten.
2. Arbeitsbaum und Port-3000-Besitz prüfen; genau einen Dev-Server verwenden.
3. Vollständige Responsive-QA-Matrix ohne Codeänderung ausführen und Screenshots der acht Kernzustände sammeln. Zusätzlich die mobilen Breiten 320, 360, 390, 412 und 430 px abdecken.
4. Defekte nach „reproduziert“, „manuell zu prüfen“ und „Geschmacksoptimierung“ sortieren.
5. Nur P0.1/P0.2/P0.3 in einem engen Änderungsset implementieren.
6. Betroffene Zustände erneut in allen drei Telefonprofilen plus Laptop prüfen.
7. Danach P1 in getrennten kleinen Änderungssets bearbeiten.
8. Erst am Schluss P2-Microinteractions und Markenfeinschliff bewerten.

## Abnahmekriterien für die spätere Implementierung

- `check:responsive` deckt mindestens Home, Setup, Spiel, Auflösung, Endstand, Hilfe, Community und die relevanten Konto-/Ranking-Zustände ab.
- Phone XS/Small/Medium/Large, Phone Landscape sowie Laptop/Monitor/TV wurden geprüft.
- Auflösung und Endstand wurden über einen echten deterministischen Spielzustand erreicht, nicht nur per direkter Route.
- Keine horizontale Dokumentbewegung und keine abgeschnittenen Buttontexte.
- Primäre Aktion ist pro Zustand eindeutig erkennbar und erreichbar.
- Browser-Konsole und HTTP-Ausgaben sind sauber; Map-/Bildfehler werden getrennt von reinen Layoutbefunden bewertet.
- Desktop-Regressionsprüfung ist nach jeder gemeinsamen Primitive-/Ergebnisänderung erfolgt.

## Nächster sinnvoller Schritt

Nach Freigabe des laufenden Änderungsstands: einen reinen QA-Durchlauf starten, die vorhandenen Screenshots für `/aufloesung` und `/endergebnis` erzeugen und erst anhand dieser Belege entscheiden, ob P0.2 tatsächlich eine Layoutänderung braucht.
