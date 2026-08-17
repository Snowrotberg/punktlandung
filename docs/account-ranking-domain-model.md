# Provider-neutrales Domaenen- und API-Modell

Stand: 3. August 2026

Dieses Dokument beschreibt die fachliche Quelle der Wahrheit. Konkrete
Firebase-Collections oder PostgreSQL-Tabellen werden erst aus diesem Modell
abgeleitet, nachdem der Anbieter-Spike abgeschlossen ist.

## Identitaeten

### Account

- `accountId`: interne, zufaellige und unveraenderliche ID
- `createdAt`, `updatedAt`, `deletedAt`
- `status`: `active`, `restricted`, `deleted`
- ein Account kann mehrere Login-Identitaeten besitzen

E-Mail-Adresse, Google-ID oder Apple-ID sind niemals der fachliche
Primaerschluessel. Sie sind austauschbare Login-Identitaeten eines Accounts.

### LoginIdentity

- `accountId`
- `provider`: `email`, `google`, `apple`
- `providerSubject`: stabile ID des Providers
- `verifiedAt`
- `lastUsedAt`

### PublicProfile

- `accountId`
- `handle`: eindeutig, normalisiert und moderierbar
- `displayName`
- `avatarKey`: optional
- `visibility`: `public`, `private`
- `createdAt`, `updatedAt`

Provider-Klarname, Provider-Foto und E-Mail werden nicht automatisch
veroeffentlicht.

## Partie

### GameSession

- `gameId`: unveraenderliche ID
- `kind`: `solo`, `couch`, `online`, `daily_challenge`
- `rulesetId` und `rulesetVersion`
- `scoringVersion`
- `category`, `difficulty`, `mode`
- `plannedRounds`, `completedRounds`
- `startedAt`, `completedAt`, `expiresAt`
- `integrityStatus`: `personal`, `verified`, `flagged`, `invalid`
- `integrityReasons`: interne maschinenlesbare Gruende
- `serverAuthority`: kennzeichnet, ob Auswahl, Zeit und Scoring vom Server
  kontrolliert wurden

Ein gespeichertes Spiel ist nach Abschluss unveraenderlich. Korrekturen werden
als Moderationsereignis protokolliert, nicht durch stilles Ueberschreiben.

### GameParticipant

- `participantId`
- `gameId`
- `accountId`: bis zum Claim optional
- `guestId`: gehashte oder indirekte kurzlebige Gastzuordnung
- `displayNameSnapshot`
- `score`
- `rank`
- `totalResponseTimeMs`
- `claimedAt`

Eine Gast-Partie darf genau einmal einem Account zugeordnet werden. Der Claim
muss atomar und idempotent sein.

### GameRound

- `roundId`, `gameId`, `roundNumber`
- `locationId`
- `categorySnapshot`
- `startedAt`, `deadlineAt`, `completedAt`
- `answerReleasedAt`
- `status`: `open`, `resolved`, `cancelled`

Zielkoordinaten und Loesungsmetadaten werden nicht Teil des oeffentlichen
Rundenobjekts, solange die Runde offen ist.

### Guess

- `guessId`, `roundId`, `participantId`
- `lat`, `lng`
- `countryCode`: optional
- `submittedAt`, `responseTimeMs`
- `distanceKm`, `points`, `badge`
- `countryCorrect`
- `accepted`: boolesch
- `rejectionReason`: optional

`distanceKm`, `points`, `badge` und `countryCorrect` werden fuer verifizierte
Partien ausschliesslich serverseitig gesetzt.

## Regeln und Versionen

### Ruleset

- `rulesetId`, `version`
- erlaubte Kategorie und Schwierigkeit
- Rundenzahl und Zeitlimit
- Move/Pan/Zoom-Regeln
- Auswahlverfahren fuer Orte
- gueltig ab/bis

### ScoringDefinition

- `scoringVersion`
- maximale Punkte pro Runde
- Distanzfunktion
- Kategorie-Sonderregeln
- Tie-Breaker-Regeln

Eine Rangliste enthaelt nie Ergebnisse aus inkompatiblen Regeln oder
Scoring-Versionen.

## Rankings

### Season

- `seasonId`
- `kind`: `daily`, `monthly`, `yearly`, `special`
- `startsAt`, `endsAt`
- `timezone`: fuer Standardperioden `Europe/Berlin`
- `rulesetId`, `rulesetVersion`, `category`
- `status`: `scheduled`, `active`, `closed`

### LeaderboardEntry

- `seasonId`, `accountId`
- `rankValue`: fachlicher primaerer Vergleichswert
- `scoreSum`, `gamesCount`, `bestScore`
- `responseTimeTieBreaker`
- `rank`, `calculatedAt`

Leaderboard-Eintraege sind reproduzierbare Ableitungen aus verifizierten
Partien. Sie sind nicht die Quelle der Wahrheit.

### MVP-Regeln

- Tag: beste Partie je Account.
- Monat: Summe der besten zehn Partien je Account.
- Jahr: Summe der besten 25 Partien je Account.
- Gleichstand: Punkte, Antwortzeit, frueherer Abschluss.
- Ein Account erscheint mit hoechstens einem Eintrag je Saison und Kategorie.

## Gebiete und Eroberungen

### Territory

- `territoryId`
- `type`: `city`, `admin_region`, `country`, `continent`
- `parentTerritoryId`: optional
- `name`, `countryCode`
- `geometryRef` und `geometryVersion`
- `active`

### TerritorySeason

- `territorySeasonId`
- Zeitraum und Regelsatz
- Einflussobergrenze pro Account und Tag
- Verfalls- und Schutzregeln

### TerritoryInfluenceEvent

- `eventId`, `territorySeasonId`, `territoryId`
- `accountId`, `gameId`, `roundId`
- `influence`
- `createdAt`

Einfluss ist ein unveraenderliches Ereignis mit Rueckverweis auf eine
verifizierte Runde. Aktueller Besitz wird daraus abgeleitet. Dadurch kann eine
invalidierte Partie auch aus dem Gebietsstand herausgerechnet werden.

## Moderation und Datenschutz

### ModerationEvent

- `eventId`
- Ziel: Account, Profil, Partie oder Ranking-Eintrag
- Aktion: `restrict`, `invalidate_score`, `restore_score`, `rename`, `delete`
- Grundcode, interner Kommentar
- Bearbeiter und Zeitstempel

### Aufbewahrung

- nicht geclaimte Gast-Partien: vorgeschlagen 72 Stunden
- abgeschlossene Account-Partien: bis zur Loeschung durch Nutzer oder definierte
  Produktfrist
- Login- und Sicherheitsprotokolle: kurze, dokumentierte Frist
- geloeschte Accounts: personenbezogene Daten entfernen; Strategie fuer
  anonymisierte historische Rankings vorab festlegen

## Provider-neutrale API-Vertraege

Alle schreibenden Endpunkte validieren eine serverseitige Sitzung. Ein
Provider-JWT allein berechtigt niemals dazu, beliebige Punkte zu schreiben.

### `POST /api/v1/ranked-games`

Startet eine Gast- oder Account-Partie.

Eingabe:

- gewuenschter `rulesetId`
- Client-Request-ID fuer Idempotenz

Ausgabe:

- `gameId`
- oeffentlicher Regelsatz
- erstes oeffentliches Rundenobjekt
- kurzlebige serverseitig gebundene Spielberechtigung

### `GET /api/v1/ranked-games/{gameId}`

- erfordert die zum Gastspiel gehoerende signierte HttpOnly-Berechtigung
- liefert nur den redigierten oeffentlichen Zustand
- ein fremdes oder ungueltiges Spiel wird gleichfoermig als nicht vorhanden behandelt

### `POST /api/v1/ranked-games/{gameId}/guesses`

Eingabe:

- `roundId`, `guessId`, Koordinaten und optionale Kategorieantwort

Ausgabe vor Rundenende:

- Annahmestatus und gegebenenfalls verbleibende Zeit

Ausgabe nach Aufloesung:

- serverseitig berechnetes Rundenergebnis und freigegebene Loesung

### Abschluss der Partie

Der Abschluss ist kein frei ausloesbarer Client-Endpunkt. Der Server schliesst
die Partie atomar mit dem letzten angenommenen Tipp beziehungsweise dem letzten
serverseitig ausgeloesten Timeout ab. Dadurch kann der Client keine Runden
ueberspringen oder die Serverzeit umgehen.

### `POST /api/v1/ranked-games/{gameId}/claim`

- erfordert permanent angemeldeten Account
- bindet genau den berechtigten Gastteilnehmer an diesen Account
- wiederholter identischer Aufruf liefert dasselbe Ergebnis
- fremder oder bereits anders geclaimter Spielstand wird abgewiesen

### `GET /api/v1/me/games`

- nur eigene Partien
- cursorbasierte Seitennavigation
- Filter fuer Kategorie, Zeitraum und Integritaetsstatus

### `GET /api/v1/leaderboards`

- Parameter: Saisonart, Kategorie, Regelsatz und Cursor
- Ausgabe enthaelt nur oeffentlich benoetigte Profildaten
- E-Mail, Providerdaten, Gastkennungen und exakte Tipps werden nie ausgegeben

### `DELETE /api/v1/me`

- erfordert erneute Authentifizierung
- Re-Authentifizierung darf hoechstens zehn Minuten alt sein
- legt idempotent einen dauerhaften Loesch-Outbox-Auftrag an
- widerruft Sitzungen und entfernt beziehungsweise anonymisiert Daten gemaess
  festgelegter Produktregel

### `GET /api/v1/me/export`

- erfordert eine serverseitig validierte Account-Sitzung
- liefert versioniertes JSON mit Profil, eigenen Login-Identitaeten und eigenen Partien
- enthaelt keine Gast-Hashes, internen Create-Request-IDs oder Daten fremder Nutzer

## HTTP-Sicherheitsvertrag

- Gastberechtigung: signiertes, maximal 72 Stunden gueltiges HttpOnly-Cookie;
  persistiert wird nur ein HMAC-Hash der zufaelligen Gast-ID.
- Cookie: `Secure`, `SameSite=Lax`, eng auf die Ranked-Game-API begrenzter Pfad.
- Schreibzugriffe: exakter Produktions-Origin und Same-Site-Pruefung.
- Zeit: ausschliesslich Serverzeit; ein Client-Zeitstempel wird nicht akzeptiert.
- Eingaben: JSON-Pflicht, maximal 8 KB, bekannte Felder, begrenzte IDs und
  validierte Koordinaten.
- Antworten: `Cache-Control: no-store`, keine offene Zielkoordinate oder echte
  Bildquell-URL vor der Aufloesung.
- Missbrauchsschutz: jede Route muss vor Domainzugriff einen austauschbaren,
  persistenten Rate-Limit-Adapter durchlaufen.
- Schluesselrotation: aktueller und voruebergehend vorheriger Signaturschluessel;
  der alte Schluessel wird nach Ablauf aller Gastberechtigungen entfernt.
- Account-Claim: sowohl Gastberechtigung als auch serverseitig validierte
  Account-Sitzung sind erforderlich.

## Ereignisse fuer die UX-Messung

- `save_prompt_view`
- `save_prompt_accept`
- `save_prompt_dismiss`
- `auth_method_selected`
- `auth_success`
- `auth_failure`
- `game_claim_success`
- `game_claim_failure`
- `leaderboard_view`

Ereignisse erhalten keine E-Mail, keinen Spielernamen, keine Raumcodes und keine
Tippkoordinaten.
