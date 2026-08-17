# Vertrauensgrenzen fuer gespeicherte und gewertete Partien

Stand: 3. August 2026

## Grundregel

Der Browser gehoert dem Spieler und ist fuer oeffentliche Rankings nicht
vertrauenswuerdig. Alles, was im Browser berechnet, gespeichert oder an den
Server behauptet wird, kann veraendert werden.

## Heutiger Zustand

### Freier Spielmodus: Solo- und Couch-Spiel

- Der Client importiert den vollstaendigen Ortskatalog einschliesslich
  Zielkoordinaten.
- Der Client waehlt Orte, verwaltet Zeit und Rundenstatus und berechnet Punkte.
- Die Sitzung wird im Browser gespeichert.

Folge: Ein Gastspiel bleibt nicht dauerhaft gespeichert. Spielt ein Nutzer mit
Konto, wird die Partie im persoenlichen Verlauf gespeichert und soll in die
Rankingwertung einfliessen. Fuer die oeffentliche Anzeige muss die Berechnung
zusaetzlich serverautoritaer nachvollziehbar sein.

### Online-Spiel

- Der WebSocket-Server waehlt Orte, nimmt Tipps an und berechnet Punkte.
- Aktive Raeume existieren nur im Arbeitsspeicher.
- Der oeffentliche Raumzustand enthaelt waehrend einer Runde das vollstaendige
  Ortsobjekt. Zusammen mit dem ausgelieferten Katalog sind Loesungsdaten fuer
  technisch versierte Spieler auffindbar.
- Wiederverbindungskennungen werden clientseitig im Sitzungsspeicher gehalten.

Folge: Der Online-Server ist eine gute Grundlage, aber der bestehende Ablauf ist
noch keine hinreichend geschuetzte Quelle fuer globale Ranglisten.

### Was „freies Spiel“ bedeutet

„Frei“ bedeutet hier nicht, dass das Spiel ungueltig oder wertlos ist. Der
Spieler kann Kategorie, Zeit, Runden und weitere Einstellungen frei waehlen;
der Browser verwaltet diesen Ablauf aktuell selbst. Solche Ergebnisse duerfen
im persoenlichen Verlauf erscheinen. Fuer den oeffentlichen Vergleich fehlt
ihnen jedoch die serverseitige Beweiskette, solange sie nicht ueber den neuen
gewerteten Ablauf gespielt wurden.

## Neue Vertrauenszonen

### Nicht vertrauenswuerdig

- Browserzustand und Local Storage
- App-WebView und JavaScript-Bundle
- vom Client behauptete Punkte, Zeiten, Rundenzahl und Account-ID
- frei waehlbare Request-Zeitstempel

### Vertrauenswuerdig nach Validierung

- Next.js-API und WebSocket-Server
- serverseitiger Ortskatalog fuer gewertete Partien
- gemeinsame serverseitige Scoring-Funktion
- Datenbankzugriff mit nicht oeffentlichen Zugangsdaten
- vom Auth-Anbieter kryptographisch gepruefte Identitaet

Der Auth-Anbieter bestaetigt nur die Identitaet. Er bestaetigt keine Punkte und
keine gueltige Partie.

## Mindestschutz fuer gewertete Partien

1. Der normale Konto-Spielablauf wird serverautoritaer gewertet; Gastspiele
   bleiben ohne dauerhafte Speicherung.
2. Ortsauswahl und echte Zielkoordinaten nur auf dem Server.
3. Oeffentliches Rundenobjekt enthaelt nur das fuer die Darstellung Notwendige.
4. Startzeit und Deadline werden vom Server gesetzt.
5. Tipp wird serverseitig einem offenen Spiel, Teilnehmer und einer offenen
   Runde zugeordnet.
6. Nur der erste gueltige Tipp beziehungsweise eine klar definierte letzte
   Abgabe wird akzeptiert.
7. Distanz und Punkte werden ausschliesslich serverseitig berechnet.
8. Abschluss und Claim sind idempotent.
9. Datenbanktabellen fuer rohe Ergebnisse sind nicht direkt vom Client
   beschreibbar.
10. Ranking liest nur abgeschlossene Ergebnisse mit Status `verified`.

## Bekannte Manipulationsversuche und Reaktion

| Versuch | Serverreaktion |
| --- | --- |
| Client sendet Gesamtpunkte | Feld wird nicht akzeptiert |
| Tipp nach Deadline | Ablehnung oder Nullwertung nach Regelsatz |
| Runde zweimal abschliessen | idempotente Wiederholung ohne zweite Wertung |
| fremde Partie claimen | Spielberechtigung und Gastbindung passen nicht |
| Kategorie oder Rundenzahl wechseln | unveraenderlicher serverseitiger Regelsatz |
| Antwort aus ausgeliefertem Katalog lesen | gewertete Antworten sind nicht im Client-Bundle |
| extrem schnelle perfekte Tipps | Ergebnis markieren; nicht automatisch oeffentlich werten |
| viele Gast-Partien erzeugen | IP-/Sitzungsrate-Limits und Kapazitaetsgrenzen |
| Provider-Account wechseln | Claim bleibt atomar an genau einem Account |

## Produktstufen

- `personal`: darf angezeigt und im eigenen Verlauf gespeichert werden; keine
  globale Wertung.
- `verified`: vollstaendig serverautoritaer; oeffentliche Wertung erlaubt.
- `flagged`: auffaellig oder technisch unvollstaendig; bis zur Klaerung keine
  oeffentliche Wertung.
- `invalid`: nach Regel- oder Moderationsentscheidung ausgeschlossen.

Diese Integritaetsstatus sind interne technische und Moderationsdaten. Sie
werden nicht in der oeffentlichen Rangliste, in oeffentlichen Profilen oder in
der normalen Nutzeransicht anderer Spieler angezeigt. Der betroffene Nutzer
kann den Status seiner eigenen Partie gegebenenfalls im persoenlichen Verlauf
als verstaendlichen Hinweis sehen.

## Sichere Einfuehrung

Der neue gewertete Ablauf startet hinter einer Feature Flag. Er ersetzt nicht
sofort die bestehenden lokalen Modi. Erst wenn Serverauswertung, Antwortschutz,
Wiederaufnahme und Lasttests bestanden sind, wird die globale Rangliste
oeffentlich aktiviert.
