# Punktlandung – Übergabe zur Kartenüberarbeitung

Stand: 5. August 2026
Aktuell im Projekt eingebundener Style: `public/map-styles/punktlandung-v7.json`

## Ziel und technische Grundlage

Die bisherige Kartengrundlage wurde durch einen eigenen, in Maputnik entwickelten Vektorstyle ersetzt. Die Basiskarte wird mit MapLibre und OpenMapTiles-/OpenStreetMap-Daten gerendert; React Leaflet bleibt als gemeinsame Steuerungs- und Interaktionsschicht im Einsatz.

Der Austausch betrifft nur die Kartengrundlage. Spielmechanik und Overlays müssen unverändert erhalten bleiben: rote und grüne Pins, Pin-Grafiken und -Farben, animierte gestrichelte Verbindungslinie, Entfernungsangaben, Ergebnislabels, Punkteberechnung und Karteninteraktionen.

## Bereits umgesetzt

### Visueller V6-Style

- Dunkle marineblaue Grundfläche mit kühlen blaugrauen Stadt- und Gebäudeflächen.
- Straßenhierarchie in Violett, Wasserflächen und Wasserläufe in Cyan-/Blautönen.
- Landschaft bewusst gedeckt statt im hellen Standard-OSM-Look.
- Vorhandene Landschaft: `grass`, `wood` und `park`.
- Ergänzte Landschaftstypen: `farmland`, `wetland`, `sand` und `rock`. Sie beginnen ab Zoom 6 schwach und werden beim Hineinzoomen deutlicher.
- Der `park`-Layer liegt unterhalb von `building`, damit transparente Grünflächen Gebäude nicht verfärben.
- `landuse_urban` bildet bebaute Gebiete in kleinen und mittleren Zoomstufen ab und wird zwischen Zoom 14 und 16 kontinuierlich auf Deckkraft 0 ausgeblendet. Ab Zoom 16 übernehmen die konkreten Gebäude.
- `building` beginnt bei Zoom 12.

### Wasserläufe und Zoomübergänge

- Der frühere einzelne Layer `waterway` wurde entfernt.
- `waterway_major` zeigt Flüsse ab Zoom 4 und blendet zwischen Zoom 12 und 13,5 aus.
- `waterway_minor` zeigt kleinere Klassen wie Kanäle, Bäche, Gräben und Drainagen ab Zoom 11,5 mit ansteigender Deckkraft.
- Die Trennung reduziert harte Übergänge zwischen den Detailstufen der Vektorkacheln. Sie kann jedoch nicht jedes durch die Quelldaten verursachte Auftauchen oder Verschwinden vollständig verhindern.

### Ortsnamen und Spielbalance

- Staats-/Landeshauptstädte besitzen den eigenen Layer `place_country_capital`: sanfter Beginn ab Zoom 4,6, vollständig sichtbar bei etwa 5,2.
- Andere sehr große Städte werden über `place_city_large` früher gezeigt: Beginn ab etwa Zoom 4,9, vollständig sichtbar bei 5,5.
- Staats-/Landeshauptstädte sind aus `place_city_large` ausgeschlossen, damit Namen nicht doppelt erscheinen.
- Die normale Spielkarte darf aktuell bis Zoom 14 reichen. Das ist genau eine Stufe mehr als zuvor.
- Ergebnis-/Auflösungskarten dürfen bis Zoom 17 reichen.
- Die tieferen POI-Beschriftungen bleiben damit während des Spiels verborgen: `poi_transport` beginnt bei 14, die Landmark-Layer bei 15 und `poi_park_square` bei 16. So wird genaueres Setzen möglich, ohne gesuchte Wahrzeichen einfach über ihre Beschriftung finden zu können.

### Einbindung in Punktlandung

Alle Kartenansichten verwenden zentral denselben V6-Style:

- Vorschaukarte auf der Startseite
- kleine und maximierte Spielkarte
- Auflösungs-/Ergebniskarte
- Karte in „Bild noch mal ansehen“

Die Startseitenkarte ist eine feste, nicht interaktive Berlin-Demo mit rotem und grünem Pin, gestrichelter Distanzlinie und Ergebnislabels. Sie zeigt dadurch direkt das Spielprinzip.

Die Plus-/Minus-Steuerung wurde für die interaktiven Karten vereinheitlicht: rechts oben, dunkle Punktlandung-Grundfarbe, weiße Zeichen und dezenter grauer Trennstrich. Die Startseitenvorschau hat absichtlich keine Zoomsteuerung.

Die zuvor sehr auffällige helle Quellenzeile wurde durch ein kompaktes dunkles Info-`i` ersetzt. Beim Öffnen werden die notwendigen Quellenangaben angezeigt. Die Attribution darf nicht vollständig entfernt werden. Leaflet wird weiterhin technisch verwendet, auch wenn die sichtbare Vektorkarte von MapLibre gerendert wird.

## Zentrale Gestaltungsentscheidungen

- Die Karte soll klar als Punktlandung-Karte erkennbar bleiben und nicht wie die helle Standarddarstellung von OpenStreetMap aussehen.
- Landschaft soll Orientierung geben, aber Stadt, Straßen und Spielpins nicht überstrahlen.
- Mintgrüner Ziel-Pin, roter Tipp-Pin und rote/pinke Verbindungslinie gehören zur Spieloberfläche, nicht in den Maputnik-Basisstyle.
- Im Spiel gilt ein anderer Informationsgrad als nach der Runde: Orientierung ja, direkt auffindbare Wahrzeichenbeschriftungen nein.
- Styleänderungen werden zentral vorgenommen und nicht pro Kartenansicht dupliziert.

## Wiederkehrende Komponenten

| Datei | Aufgabe |
|---|---|
| `public/map-styles/punktlandung-v7.json` | Aktuell maßgeblicher Kartenstyle im Projekt |
| `components/LeafletMap.tsx` | Gemeinsame Kartensteuerung, Spiel-/Ergebnis-Zoomgrenzen und Controls |
| `components/MapLibreBaseLayer.tsx` | Rendering des MapLibre-Vektorstyles |
| `components/GuessMap.tsx` | Gemeinsamer Wrapper für Spiel-, Ergebnis- und Rückblickkarten |
| `components/HomeMapPreview.tsx` | Feste Startseiten-Demo ohne Zoominteraktion |
| `components/MapAttributionBadge.tsx` | Kompakte, ausklappbare Quellenangabe |
| `app/globals.css` | Darstellung von Zoomsteuerung, Attribution und Karten-UI |

## Noch offen oder nicht entschieden

1. **Maximaler Spielzoom:** Zoom 14 ist als Teststand umgesetzt. Noch nicht entschieden ist, ob das für präzises Setzen bei Wahrzeichen ausreicht oder später weiter erhöht werden soll. Eine Erhöhung bis zu den ab Zoom 15 sichtbaren Landmark-Namen würde die Schwierigkeit deutlich verändern.
2. **Stadtbild in Zwischenzooms:** Die Mischung aus Stadtunterlage, Gebäudegeometrien und Landschaft kann stellenweise fleckig oder sehr dicht wirken. Ob und wie stark Farben, Deckkraft oder Übergänge weiter angepasst werden, ist noch offen.
3. **Straßenbild:** In mittleren Zoomstufen wirken manche Straßen sehr dominant, dicht oder leicht unscharf. Eine weitere Trennung von Haupt-, Neben-, Service- und Wirtschaftswegen wurde besprochen, aber noch nicht abschließend umgesetzt.
4. **Wasserlauf-Sprünge:** Trotz `major`/`minor` können beim Wechsel der Vektorkachel-Detailstufe einzelne Geometrien auftauchen. Weitere Änderungen sollten nur anhand reproduzierbarer Zoomstellen erfolgen.
5. **Ladezeit:** Die Startseitenkarte ist weiterhin eine echte Live-Karte und kann nach Text und Layout erscheinen. `maplibregl.prewarm()`, Messungen von `load`/`idle`, Wiederverwendung von Karteninstanzen oder eine statische Voransicht wurden besprochen, sind aber noch nicht umgesetzt beziehungsweise entschieden.
6. **Technischer Zoomfehler im Style:** `highway_major_subtle` besitzt aktuell `minzoom: 12` und `maxzoom: 11`. Dieser widersprüchliche Bereich muss korrigiert oder der Layer bewusst entfernt werden.
7. **Möglicherweise ungenutzte Quelle:** `ne2_shaded` ist weiterhin im Style vorhanden. Vor einem Entfernen muss geprüft werden, ob sie tatsächlich von keinem Layer verwendet wird.
8. **Abschließende Praxiskontrolle:** Die Kategorien Stadt/Hauptstadt, Wahrzeichen, Landschaft und Flagge müssen noch systematisch auf Desktop sowie Mobile Landscape durchgespielt werden. Dabei sind Erkennbarkeit, Pin-Präzision und gewünschter Schwierigkeitsgrad wichtiger als maximale Kartendetailfülle.

## Nächste sinnvolle Schritte

1. Zuerst den widersprüchlichen Zoombereich von `highway_major_subtle` prüfen und korrigieren.
2. Den aktuellen Zoom 14 im echten Spiel für alle Kategorien testen, bevor Landmark-Layer oder Spielzoom verändert werden.
3. Auffällige Straßen- oder Wasserübergänge mit Ort und exakter Zoomstufe dokumentieren; anschließend nur die betroffenen Layer anpassen.
4. Ladezeiten der Startseiten-, Spiel- und Ergebniskarte messen. Erst danach entscheiden, ob Prewarming, Instanz-Reuse oder eine statische Startseitenvorschau sinnvoller ist.
5. Nach dem nächsten Maputnik-Export eine neue Versionsdatei anlegen, Syntax und Expressions validieren, die zentrale Style-Datei austauschen und anschließend alle vier Kartenkontexte prüfen.

## Leitplanken für den nächsten Chat

- Keine Änderungen an Pins, Distanzlinie, Labels, Scoring oder Spiellogik vornehmen, wenn nur der Basisstyle überarbeitet wird.
- Keine Attribution ersatzlos entfernen.
- Keine Quelle oder Layer ohne vorherige Nutzungsprüfung löschen.
- POI-Zoomgrenzen und maximalen Spielzoom immer gemeinsam betrachten, da sie unmittelbar die Schwierigkeit beeinflussen.
- Bereits funktionierende Bereiche nicht pauschal neu gestalten; weitere Änderungen anhand konkreter Orte, Zoomstufen und Geräteansichten vornehmen.
