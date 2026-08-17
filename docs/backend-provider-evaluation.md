# Entscheidungsvorlage: Firebase oder Supabase

Stand: 3. August 2026

Status: offen; Supabase ist die aktuelle Arbeitshypothese, nicht die getroffene
Entscheidung.

## Punktlandung-relevante Anforderungen

- Web und geplante Android-App mit einem Konto.
- Google, E-Mail und spaeter Apple als Login-Methoden.
- Freiwilliger Claim einer bereits gespielten Gast-Partie.
- Stark relationale Daten: Nutzer, Partien, Teilnehmer, Runden, Tipps,
  Kategorien, Saisons und Rankings.
- Serverseitig verifizierte Punkte und manipulationssichere Schreibwege.
- Periodische Tages-, Monats- und Jahresauswertungen.
- Spaetere hierarchische und geographische Gebiete.
- EU-Datenregion, Loeschung, Export, Backups und nachvollziehbare Kosten.
- Zusammenarbeit mit dem bestehenden Next.js-/WebSocket-Backend auf Netcup.

## Vorlaeufiger Vergleich

| Kriterium | Supabase | Firebase |
| --- | --- | --- |
| Datenmodell | PostgreSQL, Tabellen und Beziehungen | Firestore, Dokumente und Collections |
| Auth | Google, E-Mail, Apple, Web und Mobile | besonders enge Google-/Android-Integration |
| Rankings | SQL, Views und Aggregationen passen direkt | moeglich, oft zusaetzliche Aggregat-Dokumente oder Functions |
| Gebiete | PostGIS und hierarchische SQL-Modelle | Geo-Daten moeglich, komplexere Auswertung meist anwendungsseitig |
| Echtzeit | Realtime vorhanden | sehr starkes Firestore-Echtzeit-/Offline-Modell |
| Bestehender Server | direkte Postgres/API-Anbindung | Admin SDK und Firestore-Anbindung |
| Kostenlogik | Plan plus Ressourcen-/Nutzungslimits | nutzungsabhaengige Reads, Writes, Deletes, Storage und Transfer |
| Portabilitaet | Standard-PostgreSQL erleichtert Export/Migration | staerkere Bindung an Firestore-Datenmodell und Security Rules |
| Hilfe im Umfeld | noch zu klaeren | mindestens zwei Bekannte haben praktische Erfahrung |

## Android-Einordnung

Die geplante Android-App entscheidet nicht automatisch fuer Firebase:

- Eine Trusted Web Activity nutzt weiterhin die Web-App und deren JavaScript-
  Auth-Integration. Beide Anbieter sind geeignet.
- Eine Capacitor-App kann grundsaetzlich beide JavaScript-SDKs verwenden.
- Ein spaeter komplett nativer Kotlin-Client profitiert von Firebase' sehr
  etablierter Android-Integration.
- Supabase unterstuetzt mobile OAuth-/Deep-Link-Ablaufe und native ID-Token,
  erfordert aber ebenso eine bewusst geplante Redirect-Konfiguration.

## Verbindlicher Spike vor der Entscheidung

Beide Kandidaten werden mit demselben kleinen Modell bewertet:

1. Google-Anmeldung im Web und ein dokumentierter Android-Redirect-Ablauf.
2. Gast-Partie mit fuenf Runden speichern und nach Login claimen.
3. Tagesranking und Kategorie-Ranking fuer Beispieldaten abfragen.
4. Nutzerprofil lesen und nur durch den Besitzer aendern.
5. Konto samt privaten Daten loeschen; oeffentliche Ergebnisstrategie pruefen.
6. Verdächtiges Ergebnis serverseitig invalidieren.
7. Backup/Export und lokale Testbarkeit demonstrieren.
8. Kosten fuer 1.000, 10.000 und 100.000 monatlich aktive Spieler modellieren.

## Entscheidungsregel

Supabase gewinnt, wenn relationale Rankings, Gebietsdaten, SQL-Transparenz und
Portabilitaet den groessten langfristigen Vorteil liefern und der Mobile-Spike
keine relevanten Nachteile zeigt.

Firebase gewinnt, wenn die Android-/Offline-/Realtime-Anforderungen deutlich
frueher und staerker werden als geplant oder vorhandene praktische Hilfe das
Betriebs- und Umsetzungsrisiko messbar reduziert.

## Aktuelle Tendenz

Supabase bleibt fuer das beschriebene Ranking- und Gebietssystem fachlich die
wahrscheinlich passendere Grundlage. Wegen der fest geplanten Android-App und
verfuegbarer Firebase-Erfahrung im persoenlichen Umfeld wird die Entscheidung
jedoch erst nach dem Spike getroffen.

Die gewichtete und anpassbare Bewertung steht in
`docs/backend-provider-scorecard.md`. Sie ergibt fuer den aktuellen Umfang 4,60
von 5 Punkten fuer Supabase und 3,40 fuer Firebase. Das ist die begruendete
Empfehlung, aber noch keine technische Anbieterbindung.

Login-Conversion entscheidet nicht anhand fremder Prozentzahlen ueber den
Anbieter. Evidenz, Caveats und der Punktlandung-eigene Messplan stehen in
`docs/login-ux-evidence-and-experiment.md`.

## Primaerquellen

- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Datenbank und PostGIS: https://supabase.com/docs/guides/database/overview
- Supabase Mobile Deep Links: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- Firebase Auth: https://firebase.google.com/docs/auth
- Firestore-Datenmodell: https://firebase.google.com/docs/firestore/data-model
- Firestore-Abrechnung: https://firebase.google.com/docs/firestore/pricing
- Android Trusted Web Activities: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
- Capacitor: https://capacitorjs.com/docs
