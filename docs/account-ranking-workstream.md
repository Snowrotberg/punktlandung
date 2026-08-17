# Accounts, Rankings und Mobile: autonomer Arbeitsstrang

Stand: 3. August 2026

## Ziel

Punktlandung soll weiterhin ohne Konto spielbar bleiben. Nach einer Partie kann
ein Gast sein Ergebnis freiwillig einem Konto zuordnen. Nur serverseitig
verifizierte Partien duerfen oeffentliche Rankings und spaetere
Gebietseroberungen beeinflussen.

Die technische Grundlage soll so entstehen, dass Firebase und Supabase bis zum
Abschluss eines realistischen Vergleichs austauschbare Optionen bleiben.

## Leitentscheidungen

- Kein Login-Zwang vor dem Spielen.
- Accounts sind eine zusaetzliche Speichern-, Profil- und Wettbewerbsebene.
- Der Browser ist fuer oeffentliche Ranglisten niemals die Quelle der Wahrheit.
- Solo-Partien mit Konto werden automatisch im persoenlichen Verlauf gespeichert
  und sollen in die Rankingwertung einfliessen. Couch- und Online-Partien werden
  ebenfalls gespeichert, erhalten aber einen passenden Vergleichskontext statt
  blind mit Solo-Ergebnissen vermischt zu werden.
- Gastspiele werden nicht dauerhaft gespeichert. Die serverautoritaere
  Berechnung ist die technische Voraussetzung, damit ein Konto-Ergebnis auch
  oeffentlich gewertet werden darf.
- Gewertete Solo-Partien verwenden einen versionierten, festen Regelsatz.
- Anbieterabhaengige SDKs werden erst nach dem Firebase-/Supabase-Spike in die
  Kernlogik eingebaut.
- Web, installierbare PWA und Android-App verwenden dieselben Konto- und
  Spiel-IDs.

## Was autonom umgesetzt werden kann

Diese Arbeiten benoetigen keine externen Zugangsdaten und keine endgueltige
Anbieterentscheidung:

1. Fachliches Datenmodell fuer Profile, Partien, Runden, Tipps, Saisons,
   Rankings und Gebiete definieren.
2. API-Vertraege fuer Gast-Partie, Tippabgabe, Abschluss, Ergebnis-Claim und
   Ranglistenabfrage definieren.
3. Punkteberechnung aus Client und WebSocket-Server in eine gemeinsam getestete,
   serverfaehige Domaenenfunktion ueberfuehren.
4. Zielkoordinaten und andere Loesungsdaten waehrend gewerteter Runden aus
   Client-Nachrichten entfernen.
5. Integritaetsstatus fuer gespeicherte Ergebnisse einfuehren: `personal`,
   `verified`, `flagged`, `invalid`.
6. Versionen fuer Regelsatz und Punkteformel einfuehren.
7. Automatisierte Tests fuer Punkte, Rundengrenzen, doppelte Abgaben,
   Zeitueberschreitungen und manipulierte Nutzlasten aufbauen.
8. PWA-/Android-Voraussetzungen analysieren und provider-neutrale Web-Metadaten
   vorbereiten.
9. Messplan fuer den freiwilligen Speicher- und Login-Funnel definieren.
10. Datenschutz-, Loesch-, Export-, Backup- und Moderationsanforderungen als
    Abnahmekriterien dokumentieren.

## Was eine Entscheidung oder Zugangsdaten benoetigt

- Firebase- oder Supabase-Projekt anlegen.
- Google-OAuth-Anwendung und Redirect-URLs konfigurieren.
- Apple Developer, Apple Services ID und Private Key konfigurieren.
- produktiven E-Mail-Versand und Absenderdomain einrichten.
- Datenbankmigrationen auf ein externes Produktionsprojekt anwenden.
- Datenschutzvertrag und finale Aufbewahrungsfristen freigeben.
- Android-Paketname, Signaturschluessel und Play-Console-Projekt festlegen.

## Zielablauf einer gespeicherten Gast-Partie

1. Der Server erstellt eine kurzlebige Gast-Partie und setzt eine sichere
   Gastkennung.
2. Der Server waehlt die Orte und kennt die Zielkoordinaten.
3. Der Client sendet nur Tipps und notwendige Eingaben.
4. Der Server berechnet Punkte, Zeiten und Integritaetsstatus.
5. Das Ergebnis bleibt fuer einen begrenzten Zeitraum ohne Konto abrufbar.
6. Nach dem Endstand kann sich der Gast anmelden.
7. Nach erfolgreicher Anmeldung ordnet der Server die Partie atomar dem Konto
   zu.
8. Nur `verified`-Ergebnisse fliessen in oeffentliche Ranglisten ein.

Der Speicherhinweis erscheint je Partie hoechstens einmal. Ablehnen ist ein
terminaler Zustand ohne erneutes Nachfragen. Annehmen fuehrt je nach Sitzung
direkt zum Claim oder ueber Login/OAuth zurueck zum selben Claim; Fehler bleiben
freiwillig wiederholbar oder koennen endgueltig geschlossen werden.

## Ranking-MVP

- Ein taeglicher, fuer alle gleicher Challenge-Regelsatz mit fuenf Runden.
- Tagesranking: beste verifizierte Partie eines Spielers.
- Monatsranking: Summe der besten zehn verifizierten Partien.
- Jahresranking: Summe der besten 25 verifizierten Partien.
- Separate Ranglisten je Kategorie und Regelsatzversion.
- Tie-Breaker: Punkte, dann gesamte Antwortzeit, dann frueherer Abschluss.
- Zeitstempel in UTC; sichtbare Periodengrenzen nach `Europe/Berlin`.

### Darstellung der eigenen Platzierung

Eine Rangliste zeigt nicht nur die Spitze. Die oeffentliche Ansicht soll
folgende Bereiche kombinieren:

1. Gesamtzahl der Teilnehmer im aktiven Filter.
2. Die besten 15 Eintraege.
3. Eine markierte eigene Zeile, falls der Nutzer angemeldet ist.
4. Bei Platzierungen ausserhalb der Top 15 zusaetzlich die fuenf Eintraege
   darueber und darunter.

Die eigene Zeile wird beim Oeffnen automatisch angesprungen. Die interne
Integritaetspruefung bleibt dabei unsichtbar; angezeigt werden nur Rang,
Spielername und die fuer den gewaehlten Filter relevanten Werte.

## Mobile-Zielbild

### Schneller erster Android-Release

Die Web-App wird zuerst zu einer vollstaendigen PWA. Eine Trusted Web Activity
kann diese PWA anschliessend vollbildig als Android-App starten. Die
Produktionswebsite bleibt dabei die eigentliche Anwendung.

Vorteile:

- minimale doppelte Entwicklung,
- identisches Verhalten und schnelle Web-Updates,
- bestehende Next.js-API und WebSocket-Infrastruktur bleiben erhalten.

Grenzen:

- die Android-Huelle hat wenig direkten Zugriff auf Webzustand,
- native Funktionen und besonders kontrollierte OAuth-Ablaufe sind begrenzt,
- gute Netzwerkverbindung bleibt Voraussetzung.

### Ausbau mit nativen Funktionen

Wenn Push, native Anmeldung, In-App-Kaeufe, lokale Dateien oder tiefere
Geraeteintegration wichtig werden, ist eine Capacitor-Huelle oder ein eigener
nativer Client der naechste Schritt. Backend-IDs und APIs bleiben dabei gleich.

## Sicherheits- und Betriebsabnahme

- Keine Zielkoordinaten vor der Rundenaufloesung an Clients.
- Keine vom Client behaupteten Gesamtpunkte in oeffentlichen Rankings.
- Idempotente Abschluss- und Claim-Endpunkte.
- Rate Limits fuer Auth, Spielstart, Tippabgabe und Rankings.
- Eindeutige Account-Verknuepfung bei mehreren Login-Methoden.
- Oeffentliche Handles getrennt von E-Mail und Providerprofil.
- Nutzer kann Daten exportieren und Konto loeschen.
- Ungespeicherte Gast-Partien werden automatisch geloescht.
- Rankings koennen moderiert und einzelne Ergebnisse invalidiert werden.
- Wiederherstellung aus Backup wird vor Produktionsfreigabe getestet.

## Geordnete Umsetzung

1. Providervergleich und Mobile-Entscheidungsvorlage.
2. Domaenenmodell, API-Vertraege und Vertrauensgrenzen.
3. Gemeinsame Scoring-Domaene und Tests.
4. Serverseitiger gewerteter Gast-Spielablauf hinter Feature Flag.
5. Provider-Spike mit realistischem Punktlandung-Datensatz.
6. Anbieterentscheidung und Auth-/Datenbankintegration.
7. Ergebnis-Claim, Profil und persoenlicher Verlauf.
8. Daily Challenge und Rankings.
9. PWA und Android-Pilot.
10. Saisons und Gebietseroberungs-Prototyp.
