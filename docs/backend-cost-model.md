# Vorlaeufiges Last- und Kostenmodell

Stand: 3. August 2026

Dieses Modell ist keine Preisprognose. Es macht sichtbar, welche Nutzung bei
beiden Kandidaten Kosten treibt und welche Werte im echten Anbieter-Spike
gemessen werden muessen.

Ausfuehren:

```powershell
node scripts/backend-cost-model.mjs
```

## Annahmen

- 4 gespeicherte gewertete Spiele je monatlich aktivem Nutzer
- 5 Runden je Spiel
- Firebase-Prototyp: etwa 11 Dokument-Schreibvorgaenge je Spiel
- Firebase-Prototyp: mindestens etwa 10 Transaktionslesevorgaenge je Spiel
- zusaetzlich 12 Profil-/Historien-/Ranking-Lesevorgaenge je aktivem Nutzer
- Supabase-Prototyp: 1 Spiel-, 5 Runden- und 5 Tippzeilen je Spiel
- grobe PostgreSQL-Arbeitsschaetzung: 3,5 KB je Spiel inklusive Indexanteil

Nicht eingerechnet sind unter anderem Bots, Wiederholungen, Moderation,
Backups, Logs, E-Mail, Bilder, Netzwerktransfer und Gebietsereignisse.

## Ergebnis der Annahmen

| MAU | Spiele/Monat | Firestore Reads | Firestore Writes | PostgreSQL-Zeilen | PostgreSQL grob |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1.000 | 4.000 | 52.000 | 44.000 | 44.000 | 14 MB |
| 10.000 | 40.000 | 520.000 | 440.000 | 440.000 | 140 MB |
| 100.000 | 400.000 | 5.200.000 | 4.400.000 | 4.400.000 | 1.400 MB |

## Interpretation

### Firebase

Firestore rechnet Dokument- und Index-Lesevorgaenge, Schreibvorgaenge,
Loeschungen, Speicher und Transfer ab. Besonders entscheidend ist, ob eine
Monats-/Jahresrangliste bei jeder Partie viele bestehende Ergebnisse erneut
lesen muss. Vorberechnete Ranglisten sparen oeffentliche Reads, erzeugen aber
zusaetzliche Functions- und Schreibarbeit.

Der aktuelle kostenlose Firestore-Anteil umfasst unter anderem 50.000 Reads
und 20.000 Writes pro Tag. Schon das 1.000-MAU-Beispiel kann bei ungleichmaessig
verteiltem Verkehr einzelne Tagesgrenzen beruehren. Quelle:
https://firebase.google.com/docs/firestore/pricing

### Supabase

Supabase rechnet eher nach Plan, Datenbankgroesse, Compute, Transfer und aktiven
Auth-Nutzern. Die kostenlose Datenbank ist aktuell auf 500 MB begrenzt. Im
10.000-MAU-Beispiel koennte der reine Monatszuwachs nach den groben Annahmen
noch darunter liegen; ohne Aufbewahrungs- oder Archivstrategie summieren sich
die Monate jedoch. Quelle: https://supabase.com/pricing

## Messpunkte fuer den echten Spike

1. Tatsächliche serialisierte Groesse einer Partie mit realen Ortsdaten.
2. Transaktions-Reads und -Writes fuer Start, fuenf Tipps und Claim.
3. Ranking-Rebuild fuer Tag, Monat, Jahr und Kategorie.
4. Kosten einer Invalidierung, die mehrere Ranglisten korrigiert.
5. Auth-Nutzung mit Google und E-Mail.
6. Datenwachstum nach 30, 90 und 365 Tagen.
7. Backup-, Log- und Transferbedarf.

## Kostenbremse unabhaengig vom Anbieter

- Gast-Partien ohne Claim nach 72 Stunden loeschen.
- nur verifizierte, geclaimte Partien langfristig speichern.
- Ranglisten als kompakte Projektion cachen.
- exakte Rundendetails nach definierter Frist archivieren oder reduzieren,
  sofern Produkt- und Datenschutzregeln dies erlauben.
- Spend-/Budget-Alarme vor dem Produktionsstart konfigurieren.
