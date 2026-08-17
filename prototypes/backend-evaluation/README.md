# Backend-Anbieter-Spike

Dieser Ordner mappt dieselbe getestete Punktlandung-Domaene auf zwei moegliche
Persistenzanbieter. Die Dateien sind absichtlich nicht mit der laufenden App
verdrahtet und erzeugen keine Anbieterbindung.

Bei beiden Kandidaten nutzt nur der vertrauenswuerdige Punktlandung-Server die
Anwendungsdatenbank. Browser verwenden den Anbieter fuer Auth, lesen Profile,
Partien und Rankings aber ueber dieselbe redigierende HTTP-API. Damit bleiben
Account-IDs unsichtbar und das Frontend provider-neutral.

## Gemeinsame Referenz

- `lib/rankedGame.ts`: Zustandsuebergaenge und oeffentliche Redaktion
- `lib/rankedGameService.ts`: Gastbindung und Anwendungsablauf
- `lib/leaderboards.ts`: verbindliche Ranking-Referenz
- `tests/*.test.ts`: aktuell ausfuehrbare Akzeptanzfaelle
- `tests/contracts/*.contract.ts`: unveraendert gegen beide echten Adapter

## Supabase-Prototyp

- normalisierte PostgreSQL-Tabellen,
- Row Level Security,
- direkte SQL-Rankingabfrage,
- PostGIS kann spaeter Gebiete abbilden.

Offen bis zum echten Projekt: Migration ausfuehren, Transaktionsadapter,
Auth-Claim, Query-Plan und Datenvolumen messen.

## Firebase-Prototyp

- serverprivates Firestore-Spieldokument,
- Security Rules verhindern Client-Schreibzugriff,
- vorberechnete Leaderboard-Dokumente,
- enge Android-/Google-Integration.

Offen bis zum echten Projekt: Emulator/Projekt ausfuehren, Admin-Transaktionen,
Auth-Claim, Function-Rebuild, Dokumentgroesse sowie Reads/Writes messen.

## Faire Entscheidung

Die endgueltige Bewertung darf erst erfolgen, wenn beide Adapter dieselben
gemeinsamen Tests gegen einen echten lokalen Emulator oder ein isoliertes
Entwicklungsprojekt bestanden haben. Bis dahin bleibt Supabase eine fachliche
Tendenz und keine Festlegung.
