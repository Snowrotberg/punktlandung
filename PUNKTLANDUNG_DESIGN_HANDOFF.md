# Punktlandung – Design-Handoff

**Stand:** 05.08.2026
**Zweck:** Kompakte Übergabe für einen neuen Chat zur visuellen Überarbeitung.
**Statusbegriffe:** *Umgesetzt* = im Arbeitsbaum vorhanden; *Vorschau* = als Entwurf/Referenz gezeigt, nicht automatisch produktionsgleich; *Offen* = noch zu prüfen oder zu entscheiden.

## 1. Gestaltungsgrundlage

- Punktlandung nutzt eine dunkle, sehr ruhige Außenfläche. Inhalte liegen auf großen, abgerundeten Flächen/Kacheln.
- Der zentrale App-Bereich verwendet den wiederkehrenden Verlauf Grün/Mint → Navy/Violett sowie ein dezentes Grid. Das Grid soll beim Seitenwechsel konsistent wirken.
- Primäraktion: Mintfarbener Button mit schwarzer Schrift. Sekundäraktionen sind dunkel/transluzent mit feiner Kontur.
- Desktop-Grundaufbau: linke Werbefläche, mittlerer Inhaltsbereich, rechte Werbefläche. Abstände und Größen sollen den Start- und Spieleinstellungsseiten entsprechen.
- Während des eigentlichen Spielens steht die Aufgabe/Karte im Vordergrund; dort sollen keine störenden Seitenwerbeflächen erscheinen. Auflösung und Endstand sind getrennt zu beurteilen; für den Endstand wurden Werbeflächen eher ausgeschlossen.

## 2. Viewports

Es werden sechs Projektansichten geprüft: Monitor/large desktop, 4K/TV, Laptop, Phone Small, Phone Large und Phone Landscape. Dokumentierte Beispiele aus den Tests sind 1440×768, 1920×1080 und 932×430.

- Desktop/Laptop: Account-, Hilfe-, Info- und kurze Service-Seiten möglichst als Single View.
- Mobile Portrait/Landscape: vertikales Scrollen ist zulässig, horizontales Scrollen der Bereichsnavigation ausdrücklich nicht.
- In allen Ansichten müssen Header, Ads, Karten, Kategorien und Footer sauber innerhalb des vorgesehenen Rahmens bleiben. Phone Landscape und die Spieleinstellungsseite hatten zuletzt abgeschnittene Kategorien/Felder.
- Scrollbars sollen, wo nötig, schmal und zum Design passend erscheinen.

## 3. Wiederkehrende Komponenten

### Hauptheader

Logo/Pin und „Punktlandung“ links; rechts „Spielen“, „Öffentliche Beta“, Serverstatus, Ton an/aus und Spielerkonto. Darunter verläuft eine klare Trennlinie. „Spielen“ soll auf `/spielen` führen, nicht auf die Startseite.

### Bereichsnavigation

Unter dem Hauptheader liegt eine kontextabhängige Navigation, ohne horizontales Scrollen auf Mobile:

- Konto: Übersicht, Spielverlauf, Rankings, Einstellungen.
- Hilfe: Übersicht, Spielablauf, Punkte, Konten, Rankings.
- Infos: Übersicht, Spielprinzip, Orte & Aufgaben, Mit Freunden; ältere SEO-Slugs müssen konsolidiert werden.
- Service/Rechtliches: Feedback, Datenschutz, Cookies, Impressum, Lizenzen.

### Untere Links

Aktuell vorgesehene Reihenfolge für nicht spielende Seiten:
**Hilfe · Infos · Feedback · Datenschutz · Cookies · Impressum · Lizenzen**

Das ist die zuletzt gewünschte Struktur, aber noch keine endgültige Produktentscheidung. Hilfe steht für FAQ/Nutzerhilfe, Infos für SEO-/Themenwelt, Feedback für eine eigene Nutzeraktion; danach folgt der rechtliche Block.

### Account-Dropdown und Tooltips

Das Konto-Icon soll auf allen passenden Nicht-Spiel-Seiten funktionieren. Angemeldet: Übersicht, Spielverlauf, Rankings, Einstellungen und Abmelden. Abgemeldet: Login/Registrieren. Server-, Sound- und Konto-Tooltips sollen dieselbe abgerundete Formensprache verwenden.

## 4. Seitenstatus

### Startseite `/`

**Vorschau angenommen:** zentraler Panel-Rahmen, zwei Seitenwerbeflächen, Hero „Wie gut kennst du die Welt?“, Kartenmotiv, „Direkt spielen“ sowie Solo/Party/Online-Karten.
**Offen:** Beta-Badge harmonischer mit dem Titel gestalten; Serverstatus ohne Benachrichtigungswirkung; vollständige Parität in allen sechs Viewports noch nicht bestätigt.

### Spieleinstieg `/spielen` sowie Solo/Party/Online

**Vorschau angenommen:** gemeinsamer Header/Shell, Einstellungen für Modus, Zeit, Runden, Schwierigkeit und Einschränkungen sowie Kategorie-Karten (Gemischt, Wahrzeichen, Städte, Landschaften, Flaggen, Hauptstädte).
**Offen:** Landscape-Clipping, Kartenbreiten und mobile Anordnung; Street View soll in Rankings vorerst nicht angeboten werden.

### Spielseiten, Auflösung und Endstand

**Umgesetzt/vorhanden:** Solo-, Party- und Online-Abläufe, Karten-/Tippansicht, Auflösung und Endergebnis sind im Projekt vorhanden. Angemeldete abgeschlossene Partien werden automatisch gespeichert.
**Offen:** Bilder fehlen gelegentlich; Karten laden teils langsam oder unvollständig. Die Spielansicht braucht eine eigene Performance-/Fallback-Prüfung. Endstand soll statistisch klar bleiben und nicht mit Werbung überladen werden.

### Konto `/konto` und Unterseiten

**Vorschau angenommen:** Profilname, Benutzername, Sichtbarkeit öffentlich/privat, Speichern, Statistik-Kacheln sowie Verweise auf Spielverlauf, Rankings und Einstellungen. Konto soll auf Desktop/Laptop möglichst ohne Scrollen funktionieren.
**Offen:** Header, Ads, Abstände, Footer, Typografie und Navigation sind zwischen Übersicht, Verlauf, Rankings und Einstellungen noch nicht konsequent. Mobile Landscape wurde ausdrücklich noch nicht ausreichend berücksichtigt. Keine horizontale Tab-Leiste auf Mobile.

### Hilfe/FAQ

**Umgesetzt/als Vorschau vorhanden:** Hilfe mit Übersicht, Spielablauf, Punkte, Konten und Rankings; aktive Tabs und Sprungziele sind grundsätzlich vorhanden.
**Offen:** Inhalte kürzen und Doppelungen entfernen; aktive Navigation muss beim Wechsel zuverlässig mitwechseln. Große „Partie einstellen“-Buttons auf Standardgröße reduzieren und rechts ausrichten. Hilfe soll nicht unnötig viele Unterseiten erklären.

### Infos/SEO

**Vorschau vorhanden:** SEO-/Themenwelt unter „Infos“, u. a. Spielprinzip, Orte & Aufgaben und Mit Freunden; ältere Themen-Slugs existieren bzw. wurden gezeigt.
**Offen:** klare Trennung zu Hilfe, Seitenzahl und Textumfang reduzieren, Weiterleitungen konsolidieren, alle „kostenlos starten“-Buttons auf den Standardbutton umstellen.

### Feedback

**Vorschau vorhanden:** Feedback-Textarea plus optionale E-Mail, im Desktop zweispaltig.
**Offen:** verschachtelte Feld-in-Feld-Darstellung entfernen; Laptop möglichst als One-Pager; Standard-Mintbutton und sinnvolle Fehlermeldungen.

### Rechtliches: Datenschutz, Impressum, Cookies, Lizenzen

**Vorschau angenommen:** gemeinsame Service-/Rechtsnavigation und Footer. Impressum als vier direkte Karten in einem 2×2-Raster ohne zusätzliche unnötige Außenverschachtelung. Lange Rechtstexte dürfen scrollen.
**Offen:** Cookie-Seite zeigt derzeit teils einen Tracking-Schutz-/Ladefehler; neutralen Fallback prüfen. Rechtstexte inhaltlich nicht als final juristisch freigegeben betrachten. Impressum und Feedback sollen auf Laptop möglichst kompakt bleiben.

### Rankings

**Konzept vorhanden:** Filter nach Zeiträumen (Tag/Woche/Monat/Jahr) und verfügbaren Kategorien; leere Rangliste bei fehlenden verifizierten Ergebnissen.
**Noch nicht entschieden:** Welche abgeschlossenen Sessions öffentlich zählen. Der aktuelle Prototyp unterscheidet private Historie von servergeprüften Ergebnissen. „Verifiziert“ bedeutet dabei: abgeschlossene Partie mit serverseitig prüfbaren Regeln/Punkten; nicht verifiziert bleibt privat. Die Beschränkung auf eine spezielle 10-Runden/60-Sekunden-Partie wurde vom Nutzer hinterfragt und ist keine endgültige Produktentscheidung.

## 5. Nur Vorschau/Experiment, nicht als fertig ansehen

- Servergeprüfter `/ranking-spiel`-Prototyp: Zwischenversuch mit Build-/Datei- und Bildproblemen; nicht als akzeptierter Produktionsfluss betrachten.
- Mehrere alternative Header-, Beta-Badge-, Servericon- und Accountlayouts wurden gezeigt. Nur die gemeinsame Designrichtung ist übernommen; einzelne Varianten sind keine verbindlichen Implementierungen.
- Vorschau-Screenshots beweisen keine responsive oder funktionale Vollständigkeit.

## 6. Wichtigste offene Designprobleme

1. Einen gemeinsamen Shell-/Header-/Footer-Baustein für Konto, Hilfe, Infos und Rechtliches herstellen.
2. Ads exakt an Start/Spieleinstellungen angleichen; Inhalte dürfen nicht in die Werberails ragen.
3. Servericon ohne grünen Außenring/isolierten Punkt; Beta-Badge neu bewerten.
4. Mobile Navigation stapeln oder kompakt umbrechen, niemals horizontal scrollen lassen.
5. Typografie, Buttonhöhen, Abstände und aktive Zustände über alle Unterseiten vereinheitlichen.
6. Karten-/Bild-Ladefehler mit Fallback und messbarer Ladezeit untersuchen.
7. Hilfe/Infos/SEO-Inhalte zusammenführen bzw. entdoppeln, ohne SEO-Zweck und Nutzerverständlichkeit zu verlieren.
8. Ranking-Regeln für Solo, Party, Zeit, Schwierigkeit, Kategorien und serverseitige Fairness entscheiden.

## 7. Sinnvolle nächste Schritte

1. Referenzlayout der Startseite und Spieleinstellungen als gemeinsame Layout-Komponente festlegen.
2. Konto-, Hilfe-, Infos- und Rechtsseiten darauf umstellen; zuerst Desktop/Laptop, danach alle Mobile-Varianten.
3. Header-Details (Spielen-Link, Beta, Server, Sound, Account-Dropdown/Tooltips) zentral korrigieren.
4. Footer- und Bereichsnavigation mit funktionierenden Links und aktiven Zuständen durchtesten.
5. Hilfe/Infos-Texte und große CTA-Flächen reduzieren/vereinheitlichen.
6. Bild-/Kartenpfade, Lade-Fallbacks und Endstanddarstellung reparieren.
7. Erst danach Ranking-Produktregeln und den technischen Ranked-Flow erneut angehen; den fehlerhaften Zwischenprototyp nicht als Testbasis verwenden.

**Hinweis:** Diese Übergabe dokumentiert Design- und Produktentscheidungen aus dem Gespräch. Sie ersetzt keinen abschließenden Browser-, Accessibility-, Performance- oder Rechtstext-Check.
