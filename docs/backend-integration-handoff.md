# Backend-Integration: sichere Uebergabe

Stand: 3. August 2026

Die App ist fuer die Anbieterauswahl vorbereitet, aber Accounts und gewertete
Spiele sind noch nicht produktiv angeschlossen. Dieser Ablauf verhindert, dass
Testdaten oder geheime Schluessel versehentlich in Produktion gelangen.

## Was bereits ohne Anbieter fertig ist

- verbindliche serverseitige Punkteberechnung,
- Gastspiel, idempotente Tipps, Timeout, Claim nach Login und Invalidierung,
- Tages-, Monats-, Jahres- und Kategorie-Rankinglogik,
- Profile, Handle-Regeln und Loesch-Tombstone,
- app-eigene Account-ID mit getrennten Supabase-/Firebase-Auth-Bindungen und
  atomarem Google-/E-Mail-/Apple-Identity-Linking,
- versionierter Account-Export ohne Gastgeheimnisse sowie ein Loesch-Outbox-
  Vertrag mit maximal zehn Minuten alter Re-Authentifizierung,
- sichere Auth-Ruecksprungpfade,
- signierte Gastberechtigung, Origin-/Payload-Pruefung und verpflichtender
  Rate-Limit-Port an der provider-neutralen HTTP-Grenze,
- Repository-Schnittstelle statt Anbieteraufrufen in der Spiellogik,
- wiederverwendbare Adapter-Vertragssuite fuer Idempotenz, Isolation, atomare
  Updates, Identity-Linking, Profile, Rankings, Moderation, Loesch-Outbox und Gast-Cleanup,
- Supabase-Schema und Firestore-Modell/Rules fuer denselben Ablauf,
- deaktivierte Feature-Schalter und validierte Serverkonfiguration,
- PWA-Manifest und Android-TWA-Entscheidungspfad.

## Fuer den echten Spike benoetigt

1. Je ein isoliertes Supabase- und Firebase-Entwicklungsprojekt, niemals Produktion.
2. EU-Region, Projekt-URLs und ausschliesslich dort erzeugte Test-Zugangsdaten.
3. Eine Google-OAuth-Testkonfiguration mit Web-Callback; spaeter Android-Paketname
   und Signatur-Fingerprint fuer den TWA-Test.
4. Lokale `.env.local`-Werte nach `.env.example`; diese Datei darf nicht committed werden.
5. Freigabe, die jeweiligen SDK-Abhaengigkeiten zu installieren.

## Gleicher Akzeptanzlauf fuer beide Kandidaten

1. Mit Google anmelden und abmelden; E-Mail-Login inklusive Wiederherstellung testen.
2. Als Gast eine Fuenf-Runden-Partie starten, abschliessen und nach Login claimen.
3. Wiederholte Requests duerfen weder zweite Tipps noch doppelte Punkte erzeugen.
4. Ein fremder Nutzer darf private Partie, Tipps oder Profilfelder nicht lesen/aendern.
5. Tages- und Kategorie-Ranking muessen der Referenz in `lib/leaderboards.ts` entsprechen.
6. Eine verdächtige Partie invalidieren und alle betroffenen Rankings korrigieren.
7. Kontoexport und Loeschung ausfuehren; oeffentliche Historie gemaess Richtlinie behandeln.
8. Backup/Export erstellen und in ein leeres Testprojekt wiederherstellen.
9. Browser, Android-TWA-Rueckkehr und Netzwerkunterbrechung testen.
10. Reads, Writes, Datenmenge, Laufzeit und manuellen Betriebsaufwand protokollieren.

## Anschlussreihenfolge nach der Entscheidung

1. Einen Adapter fuer `RankedGameRepository` implementieren und gegen die bestehenden
   Domain-Tests pruefen.
2. Auth-Adapter, serverseitige Session-Pruefung und persistenten Rate-Limit-Adapter anschliessen.
3. Die duennen Next.js-API-Routen an `RankedGameHttpApi` anbinden; Start, Tipp,
   Status und Claim besitzen dadurch bereits einen getesteten Transportvertrag.
4. Profil-, Historien- und Ranking-API auf denselben Sitzungs- und Fehlervertrag setzen.
5. Accounts nur intern aktivieren: `ACCOUNTS_ENABLED=true`, Rankings noch aus.
6. Login und Claim im geschlossenen Test abnehmen.
7. Erst danach `RANKED_GAMES_ENABLED=true` setzen und Ranking-Beta starten.

## Harte Sicherheitsregel

Der Browser meldet nur den Tipp. Zielkoordinaten, Zeitentscheidung, Punkte,
Verifikation und Ranking-Schreibvorgaenge bleiben serverseitig. Die bestehenden
freien Spielmodi mit clientseitigem Ortskatalog duerfen deshalb nicht unveraendert
als gewertete Ranglistenpartien verwendet werden.
