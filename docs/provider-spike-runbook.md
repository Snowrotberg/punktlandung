# Runbook: echter Supabase-/Firebase-Spike

Stand: 3. August 2026

Dieses Runbook beginnt genau dort, wo die zugangsdatenfreie Grundlage endet.
Es installiert keine Anbieter-SDKs in der Haupt-App und verwendet niemals das
Produktionsprojekt.

## Preflight

```powershell
npm.cmd run check:provider-spike
```

Fuer den vollstaendig lokalen Vergleich werden benoetigt:

- laufender Docker-Dienst und lokal gepinnte Supabase CLI,
- Java Runtime und lokal gepinnte Firebase CLI,
- ausreichend Speicher fuer die Emulatorimages.

Aktueller Maschinenstand am 3. August 2026: Docker-Client vorhanden, Docker-
Dienst nicht laufend; Java, Supabase CLI und Firebase CLI nicht vorhanden.

Alternativ koennen zwei isolierte EU-Entwicklungsprojekte verwendet werden.
Zugangsdaten kommen ausschliesslich in nicht versionierte Spike-Env-Dateien;
Service-/Admin-Schluessel niemals in `NEXT_PUBLIC_*`.

## Isolierte Struktur

```text
prototypes/backend-evaluation/
  supabase/   Schema, Ranking-SQL, spaeter Adapter und Testkonfiguration
  firebase/   Rules, Indizes, Modell, spaeter Adapter und Testkonfiguration
```

Die Haupt-App erhaelt erst nach der protokollierten Entscheidung genau einen
Gewinneradapter. CLI- und Emulatorpakete werden gepinnt und nur als
Entwicklungswerkzeuge installiert.

## Gemeinsame Pflichtsuiten

Jeder Adapter registriert unveraendert:

- `ranked-game-repository.contract.ts`
- `account-profile-repository.contract.ts`
- `account-identity-repository.contract.ts`
- `leaderboard-adapter.contract.ts`
- `ranked-moderation.contract.ts`
- `account-deletion-outbox.contract.ts`

Zusaetzlich laufen `test:backend-foundation` und der Anbieter-Prototypcheck.

## Supabase-Lauf

1. Isolierten lokalen Stack beziehungsweise EU-Testprojekt starten.
2. `schema.sql` als Migration anwenden.
3. Sicherstellen, dass Browserrollen keine der zehn Anwendungstabellen lesen
   oder schreiben koennen.
4. PostgreSQL-Adapter mit echten Transaktionen und Revision/CAS implementieren.
5. Ranking-SQL fuer Tag, Monat, Jahr und Kategorien gegen die gemeinsame Suite testen.
6. Cleanup, Moderations-Outbox und Loesch-Lease parallel ausfuehren.
7. Query-Plans, Zeilen-/Indexgroesse, Auth- und Transferoperationen protokollieren.
8. Export sowie Backup/Restore in ein leeres Testprojekt pruefen.

## Firebase-Lauf

1. Firestore- und Auth-Emulator beziehungsweise EU-Testprojekt starten.
2. Rules und Indizes deployen; Emulator-Rules-Tests muessen jeden direkten
   Clientzugriff auf Anwendungskollektionen ablehnen.
3. Admin-Transaktionsadapter fuer dasselbe Domainmodell implementieren.
4. Handle-Claims, Auth-Bindings, Claim, Moderation und Loesch-Leases unter
   konkurrierenden Requests testen.
5. Rankingprojektion nach Abschluss, Claim und Invalidierung neu aufbauen.
6. Dokumentgroesse sowie Reads, Writes, Deletes, Functions und Transfer messen.
7. Export sowie Emulator-/Projekt-Backup und Restore pruefen.

## Auth-/Android-Lauf fuer beide

1. Google und E-Mail komplett: Neuanlage, Verifikation, Login, Logout,
   Wiederherstellung und Session-Widerruf.
2. Gastpartie vor Login fertig spielen, OAuth abbrechen, wiederholen und claimen.
3. TWA: Zurueck-Taste, Browserwechsel, Prozessende und Callback-Rueckkehr.
4. Gleiche Provideridentitaet darf nie zwei App-Accounts erzeugen.
5. Neues Login-Verfahren darf nur nach frischer Authentifizierung verknuepft werden.

## Messprotokoll und Entscheidung

Fuer jeden Lauf werden festgehalten: Commit, CLI-/Emulatorversion, Region,
Laufzeit, Operationen, Datenmenge, fehlgeschlagene Tests, manueller Aufwand,
Backup-/Restore-Ergebnis und Android-Abweichungen. Erst danach wird die
gewichtete Scorecard aktualisiert und der Gewinner festgelegt.
