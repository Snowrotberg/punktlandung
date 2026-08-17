# Bewertungsmatrix: Supabase oder Firebase

Stand: 3. August 2026

Diese Matrix bewertet die beiden Kandidaten fuer die heute bekannten
Punktlandung-Anforderungen. Eine 5 bedeutet sehr gute, eine 1 geringe Eignung.
Die Gewichtung kann vor der Entscheidung geaendert werden; dadurch bleibt die
Empfehlung nachvollziehbar statt gefuehlt.

| Kriterium | Gewicht | Supabase | Firebase | Begruendung |
| --- | ---: | ---: | ---: | --- |
| Relationales Spieldatenmodell | 25 % | 5 | 3 | Partien, Runden, Tipps, Nutzer und Saisons sind stark verbunden. |
| Rankings und Auswertungen | 20 % | 5 | 3 | SQL passt direkt; Firestore braucht eher Projektionen und Functions. |
| Android und Login | 15 % | 4 | 5 | Beide funktionieren in PWA/TWA; Firebase hat die engere native Integration. |
| Betrieb und vorhandene Hilfe | 10 % | 4 | 4 | Supabase ist fuer SQL gut inspizierbar; Firebase-Erfahrung im Umfeld senkt Risiko. |
| Export und Wechselbarkeit | 10 % | 5 | 3 | PostgreSQL ist standardisiert; Firestore-Modell und Rules sind spezifischer. |
| Spaetere Gebiete und Geodaten | 10 % | 5 | 2 | PostGIS ist fuer Hierarchien und Flaechenabfragen ein deutlicher Vorteil. |
| Realtime und Offline | 5 % | 3 | 5 | Firestore ist hier besonders stark; derzeit ist Offline kein Kernziel. |
| Kosten nachvollziehen | 5 % | 4 | 3 | Compute/Storage gegen viele einzelne Reads/Writes; beides muss gemessen werden. |
| **Gewichtetes Ergebnis** | **100 %** | **4,60 / 5** | **3,40 / 5** | Aktueller Anforderungsstand, noch kein Anbieter-Spike. |

## Empfehlung

Supabase ist die begruendete Standardempfehlung fuer Punktlandung. Ausschlaggebend
sind nicht Login oder Android, denn beides koennen beide Anbieter, sondern die
langfristig wichtigeren Rankings, Beziehungen und Geodaten.

Die Empfehlung wird erst dann zur technischen Festlegung, wenn der kleine
Anbieter-Spike bestanden ist. Firebase sollte Supabase nur noch ueberholen, wenn
mindestens einer dieser Punkte im echten Test eintritt:

- Google-Login oder Android-Rueckkehr ist mit Supabase unzuverlaessig.
- Offline-Spiel wird vor Gebiets- und Rankingfunktionen zum Kernziel.
- Der Supabase-Adapter ist im gemessenen Betrieb deutlich komplexer oder teurer.
- Die praktisch verfuegbare Firebase-Unterstuetzung reduziert den Aufwand
  nachweislich staerker als das passendere SQL-Modell.

## Datenschutz- und Betriebs-Gates fuer beide Anbieter

Kein Kandidat geht produktiv, bevor alle folgenden Punkte nachweisbar sind:

- EU-Datenregion und Auftragsverarbeitung sind fuer das konkrete Projekt gesetzt.
- Server-Secrets gelangen weder in `NEXT_PUBLIC_*` noch in Browser oder App-Bundle.
- Export, Kontoloeschung und Umgang mit oeffentlichen Ranglistenergebnissen sind getestet.
- Automatische Backups beziehungsweise Exporte und eine Wiederherstellungsprobe sind dokumentiert.
- Budgetwarnungen, Rate Limits, Protokollaufbewahrung und Missbrauchsschutz sind aktiviert.
- Google-/E-Mail-Login funktionieren im mobilen Browser, in der TWA und nach App-Neustart.

## Entscheidungsprotokoll

Die finale Entscheidung soll Datum, getestete Projektregion, Testergebnisse,
gemessene Kostenoperationen und bekannte Abweichungen enthalten. Bis dahin bleibt
`ACCOUNT_BACKEND_PROVIDER=disabled` der sichere Produktionsstandard.
