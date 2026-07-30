# Performance-Baseline vom 29. Juli 2026

## Messung vor der Bildoptimierung

Lokale Lighthouse-Messung gegen den produktionsnahen Build. Die Werte dienen
als Entwicklungs-Baseline und ersetzen keine späteren Felddaten aus der Google
Search Console.

| Seite | Gerät | Performance | Barrierefreiheit | SEO | FCP | LCP | TBT | CLS | Übertragen |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Startseite | Desktop | 84 | 100 | 100 | 0,5 s | 2,9 s | 40 ms | 0 | 13.573 KiB |
| Startseite | Mobile | 36 | 100 | 100 | 3,8 s | 69,9 s* | 1.110 ms | 0 | 13.573 KiB |
| So funktioniert Punktlandung | Desktop | 100 | 100 | 100 | 0,7 s | 0,7 s | 30 ms | 0 | 926 KiB |
| So funktioniert Punktlandung | Mobile | 54 | 100 | 100 | 3,7 s | 7,8 s | 520 ms | 0 | 926 KiB |

\* Der ungewöhnlich späte lokale Mobile-LCP muss nach dem Deployment erneut
gemessen und mit Felddaten abgeglichen werden. Er ist kein belastbarer Realwert.

## Größter Befund und Korrektur

Die Startseite lud 13 große Karten-, Kategorie- und Modusbilder mit zusammen
rund 12,3 MiB. Die gleichen Bilder werden nun bei unveränderten Abmessungen als
WebP ausgeliefert und belegen zusammen rund 1,0 MiB. Das entspricht einer
Reduktion um ungefähr 92 Prozent. Das sichtbare Kartenbild erhält außerdem eine
feste Größe und hohe Ladepriorität.

Die Optimierung ist mit `npm run assets:optimize-ui` reproduzierbar. Die alten
Quelldateien bleiben als Ausgangsmaterial erhalten; die Anwendung referenziert
die komprimierten WebP-Dateien.

## Qualitätssicherung

- Startseite: 6/6 Responsive-Checks bestanden
- So funktioniert Punktlandung: 6/6 Responsive-Checks bestanden
- Orte und Aufgaben: 6/6 Responsive-Checks bestanden
- Sichtprüfung auf Smartphone- und Desktop-Größe ohne erkennbare
  Qualitätsverluste
- Produktions-Build und TypeScript-Prüfung erfolgreich

## Nach dem nächsten Deployment

1. Lighthouse für Startseite und beide Kernseiten auf Mobile und Desktop erneut
   ausführen.
2. LCP, INP und CLS aus der Search Console ergänzen, sobald Felddaten vorliegen.
3. Falls TBT/INP weiter auffällig sind, JavaScript-Ausführung und das Vorladen
   noch nicht sichtbarer Spielinhalte untersuchen.
