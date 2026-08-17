# Abschluss-Audit der provider-neutralen Grundlage

Stand: 3. August 2026

Dieser Audit trennt nachgewiesene lokale Grundlagen von Funktionen, die erst
mit einem echten Firebase-/Supabase-Projekt als fertig gelten koennen.

## Lokal nachgewiesen

| Anforderung | Beleg | Status |
| --- | --- | --- |
| Ohne Login starten und spaeter speichern | `RankedGameService`, signierte Gastberechtigung und atomarer Claim | nachgewiesen |
| Serverautoritaere Punkte und Zeiten | `roundEvaluation.ts`, `rankedGame.ts`; HTTP akzeptiert keine Clientzeit oder Clientpunkte | nachgewiesen |
| Keine offene Loesung im Client | redigierter `PublicRankedGame`, opaker Promptpfad und serverseitiger SSRF-geschuetzter Bildabruf | nachgewiesen |
| Wiederholte Requests | Create-, Guess- und Claim-Idempotenz sowie Repository-Vertragssuite | nachgewiesen |
| Faire Rankings | nur verifizierte Partien; Tag 1, Monat 10, Jahr 25; Berlin-Perioden und Tie-Breaker | nachgewiesen |
| Ranking-Datenschutz | private/inaktive Profile ausgeschlossen; oeffentliche Projektion entfernt Account-, Spiel- und Aktivitaets-IDs | nachgewiesen |
| Profile | Validierung, reservierte Namen, atomare Handle-Eindeutigkeit, Update und Loesch-Tombstone | nachgewiesen |
| Anbieterunabhaengige Identitaet | App-Account-ID getrennt von Firebase UID/Supabase User-ID; atomare Auth-Bindung und frisches sicheres Methoden-Linking | nachgewiesen |
| Profil-API | eigene und oeffentliche Projektion; private/inaktive Profile sowie interne Account-/Moderationsfelder bleiben verborgen | nachgewiesen |
| Ranking-API | validierte Scopes, begrenzte redigierte Projektion, Cache- und Rate-Limit-Vertrag | nachgewiesen |
| Gast-Aufbewahrung | 72-Stunden-Frist und begrenzter Cleanup-Port, Claim entfernt Gastbindung | nachgewiesen |
| Export und Loeschstart | versioniertes Eigendaten-JSON, Eigentuemerkontrolle, Loesch-Outbox und Re-Auth-Alter | nachgewiesen |
| HTTP-Schutz | Origin, SameSite/Secure/HttpOnly, Payloadlimit, bekannte Felder, No-Store und verpflichtender Rate-Limit-Port | nachgewiesen |
| Schluesselbetrieb | Mindestlaenge und kontrollierte aktuelle/vorherige Signaturschluessel | nachgewiesen |
| Anbieterwechselbarkeit | Domain-, HTTP-, Repository-, Auth- und Rate-Limit-Ports ohne Anbieter-SDK | nachgewiesen |
| PWA-/Android-Grundlage | Webmanifest, PWA-Icons, TWA-Entscheidung und Asset-Links-Vorlage | nachgewiesen |
| Freiwilliger Speicherablauf | einmaliges Angebot, terminale Ablehnung, OAuth-Rueckkehr, Retry und Claim als getestete Zustandsmaschine | nachgewiesen |

Automatisierte Belege:

```powershell
npm.cmd run test:backend-foundation
npm.cmd run build:check
```

Die Vertragssuiten unter `tests/contracts/` fuer Spielpersistenz, Profile,
Identitaeten, Rankings, Moderation und Loesch-Outbox muessen spaeter
unveraendert gegen jeden echten Anbieteradapter laufen.

## Bewusst noch nicht produktiv verbunden

- keine Next.js-Produktionsrouten fuer Accounts oder gewertete Spiele,
- kein sichtbarer Login-, Speicherprompt-, Profil- oder Ranking-Screen,
- keine echte Auth-Sitzung und kein E-Mail-/Google-/Apple-Provider,
- kein produktiver Datenbank-, Rate-Limit-, Cleanup-, Export- oder Loesch-Worker,
- keine ausgefuehrte Supabase-Migration und keine deployten Firestore Rules,
- kein signiertes Android-Paket und keine echten Digital Asset Links.

Diese Punkte ohne Anbieterprojekt zu simulieren wuerde keine belastbare
Produktionsaussage liefern. Die Feature Flags bleiben deshalb `false`.

## Externe Abschluss-Gates

1. Isolierte EU-Entwicklungsprojekte fuer Supabase und Firebase bereitstellen.
2. Anbieteradapter gegen dieselbe Repository- und Akzeptanzsuite ausfuehren.
3. Google- und E-Mail-Login im Web sowie in einer TWA testen; Apple danach.
4. Rankingabfragen, Cleanup, Export, Loesch-Worker, Backup und Restore real messen.
5. Kostenoperationen und Datenwachstum in die Bewertungsmatrix eintragen.
6. Anbieterentscheidung protokollieren und nur den Gewinner in die App verdrahten.
7. Accounts intern, Claim im geschlossenen Test und Rankings zuletzt aktivieren.

## Aktuelle Entscheidung

Supabase bleibt mit 4,60 von 5 Punkten die fachliche Empfehlung gegenueber
Firebase mit 3,40. Das Ergebnis ist wegen SQL/PostgreSQL, Rankingaggregation,
Portabilitaet und PostGIS plausibel, aber erst nach den externen Gates bindend.

Die Login-Evidenz und der eigene Conversion-Messplan stehen in
`docs/login-ux-evidence-and-experiment.md`. Fremde Checkout- oder Google-
Fallstudien werden nicht als Punktlandung-Prognose behandelt.
