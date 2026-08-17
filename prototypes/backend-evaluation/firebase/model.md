# Firestore-Abbildung des gemeinsamen Punktlandung-Modells

## Collections

### `accounts/{accountId}`

App-eigene, zufaellige und unveraenderliche Account-ID mit Status und
Lebenszyklusdaten. Sie ist weder Firebase UID noch Supabase User-ID und bleibt
bei einem spaeteren Auth-Anbieterwechsel stabil.

### `authBindings/{bindingId}`

Serverprivate Zuordnung aus Auth-Backend plus dessen User-ID zur app-eigenen
Account-ID. `bindingId` wird aus Backend und User-ID deterministisch gehasht;
die Transaktion verhindert, dass eine Backend-Identitaet zwei Accounts gehoert.

### `loginIdentities/{identityId}`

Serverprivate Google-, E-Mail- oder Apple-Identitaet mit eindeutigem
`provider + providerSubject`. Linking ist nur aus einer bereits
authentifizierten Sitzung nach frischer Authentifizierung der neuen Identitaet
zulaessig.

### `profiles/{accountId}`

Oeffentliche und eigene Profildaten. Provider-E-Mail und Login-Identitaeten
bleiben in Firebase Auth und werden nicht in oeffentliche Dokumente kopiert.
Browser lesen die Dokumente nicht direkt; die gemeinsame Server-API entfernt
interne Account- und Dokument-IDs aus oeffentlichen Antworten.

### `handleClaims/{normalizedHandle}`

Serverprivater Eindeutigkeitsanspruch mit `accountId`. Er wird in derselben
Firestore-Transaktion wie das Profil erstellt, verschoben oder geloescht. Eine
vorherige Query auf `profiles` reicht wegen konkurrierender Requests nicht aus.
Der Browser prueft Verfuegbarkeit nur ueber die limitierte Profil-API.

### `rankedGames/{gameId}`

Ein serverautoritaeres Dokument enthaelt den Zustand einer kompletten
gewerteten Solo-Partie:

- Create-Request- und Gast-Hash,
- Account-ID nach Claim,
- Regeln und Versionen,
- alle serverprivaten Runden inklusive Loesung,
- angenommene Tipps und berechnete Ergebnisse,
- Score, Zeit und Integritaetsstatus,
- Revision fuer Transaktionswiederholungen.

Der Browser bekommt dieses Dokument nie direkt. Next.js beziehungsweise der
WebSocket-Server fuehrt eine Firestore-Transaktion aus und gibt ausschliesslich
`PublicRankedGame` zurueck. Das gemeinsame Modell bleibt bei maximal 25 Runden
deutlich unter Firestores Dokumentgroessenlimit; dies muss mit realen
Katalogdaten im Anbieter-Spike gemessen werden.

### `leaderboards/{scope}/entries/{accountId}`

Vorberechnete interne Projektionen. `scope` kodiert Periode, Kategorie,
Regelsatz und Scoring-Version. Eine vertrauenswuerdige Function aktualisiert
den Eintrag nach Abschluss, Claim, Invalidierung oder Saisonabschluss. Die
Server-API gibt daraus nur `PublicLeaderboardEntry` ohne Account- oder Spiel-ID aus.

Firestore-Read-Time-Aggregationen liefern keine Echtzeitupdates. Deshalb ist
fuer eine schnelle oeffentliche Rangliste eine Write-Time-Aggregation oder ein
periodischer Rebuild erforderlich.

### `moderationEvents/{eventId}`

Nur server-/adminseitig les- und schreibbares Auditprotokoll.
Eine Score-Invalidierung schreibt Spielzustand und Ereignis atomar. Das Ereignis
bleibt `projectionStatus=pending`, bis alle betroffenen Ranglisten neu aufgebaut
sind; erst danach wird es idempotent als abgeschlossen markiert.

### `accountDeletionJobs/{deletionRequestId}`

Serverprivater, idempotenter Outbox-Auftrag. Erst der Worker widerruft Sitzungen,
entfernt Provider-Identitaet und persoenliche Daten und markiert den Auftrag als
abgeschlossen. Eine kurze Lease verhindert parallele Ausfuehrung und erlaubt
die Wiederaufnahme nach einem Worker-Absturz. Fehler bleiben mit
nicht-personenbezogenem Fehlercode retrybar; nach Abschluss wird die Account-ID
aus dem Auftrag entfernt.

## Atomare Operationen

- Profil: Transaktion prueft beziehungsweise verschiebt `handleClaims` und
  schreibt das Profil gemeinsam; dadurch kann ein Handle nie doppelt vergeben werden.
- Spielstart: Transaktion prueft Create-Request-ID und legt ein Dokument an.
- Tipp: Transaktion liest Revision und offene Runde, wertet serverseitig und
  schreibt genau eine neue Revision.
- Claim: Transaktion prueft Gastbindung, Abschluss und leere Account-ID.
- Claim entfernt Gast-Hash und Gast-Ablaufdatum nach erfolgreicher Zuordnung.
- Retention-Job loescht ungeclaimte Dokumente nach 72 Stunden in begrenzten
  Batches; die Adapter-Vertragssuite prueft Auswahl und Batch-Limit.
- Invalidierung: Transaktion setzt Status und stoesst den Ranking-Rebuild an.

## Erwarteter Zusatzaufwand gegenueber SQL

- Monats-/Jahresregeln benoetigen vorberechnete Accounteintraege oder Functions.
- Jede Aenderung eines verifizierten Ergebnisses muss betroffene Ranglisten
  reproduzierbar neu berechnen.
- Security Rules schuetzen Dokumentzugriffe, ersetzen aber nicht die
  serverseitige Punkteberechnung.
