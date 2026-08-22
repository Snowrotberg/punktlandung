# Punktlandung Ortskatalog

Der Spielkatalog besteht aus kleinen Metadaten, nicht aus lokal gespeicherten Bildern.

- `data/locations.ts` enthaelt die handgepflegte Starter-Liste.
- `data/generated/locations.generated.json` enthaelt automatisch erzeugte Wikidata/Wikimedia-Orte.
- Die Bilder selbst bleiben bei Wikimedia Commons und werden nur bei Bedarf geladen.

Generator starten:

```bash
npm run catalog:generate
```

Optionale Groesse pro Kategorie:

```bash
CATALOG_TARGET_PER_CATEGORY=300 npm run catalog:generate
```

Der Generator fragt Wikidata nach bekannten Orten mit Koordinaten, Land, Bild und Popularitaetssignal ab.
Commons liefert danach nur die Bilddatei. Dadurch ist Commons die Bildquelle, aber Wikidata der Filter fuer relevante Spielorte.

Kategorien:

- `landmarks`: bekannte Bauwerke, UNESCO-Orte, Monumente, touristische Attraktionen.
- `cities`: groessere oder sehr bekannte Staedte mit Bild und Koordinaten.
- `landscapes`: Nationalparks, Berge, Wasserfaelle, Seen, Wuesten, Inseln und andere bekannte Naturorte.
- `capitals`: Hauptstaedte souverainer Staaten.
- `flags`: Flaggen souverainer Staaten.

Schwierigkeitsgrad:

- `easy`: sehr viele Wikidata/Wikipedia-Sitelinks oder Flaggen.
- `medium`: solide internationale Bekanntheit.
- `hard`: bekannt genug fuer den Katalog, aber weniger global praesent.

Die generierte Datei darf gross werden, bleibt aber klein im Vergleich zu Bilddateien, weil sie nur Textdaten enthaelt.

## Aktives Qualitätsprofil

Die generierte Datei ist der nachvollziehbare Quellbestand. Im Spiel aktiv sind nur Bilder, die das Profil `strict-2010-tv-v1` erfüllen:

- Fotoaufnahme ab 2010; ein Uploaddatum ersetzt kein fehlendes Aufnahmejahr.
- Quelldatei mindestens 2560 × 1440 Pixel.
- Querformat zwischen 1,25:1 und 3:1, damit der `object-cover`-Ausschnitt auf Handy, Laptop und TV sinnvoll bleibt.
- Primärbild eines passend typisierten Wikidata-Objekts oder semantisch geprüfte und freigegebene Commons-Variante.
- Keine Quarantäne, Konfliktmotive, Karten, Collagen oder andere ausgeschlossene Inhalte.
- Kuratierte Varianten benötigen mindestens Bildscore 8.

Flaggen verwenden offizielle Vektordateien und sind von Aufnahmejahr und Pixelabmessungen ausgenommen. Für Handy, Laptop und TV gibt es bewusst keinen getrennten Ortskatalog: Ein TV-taugliches Masterbild bleibt die gemeinsame Quelle, Wikimedia liefert abhängig vom Viewport eine kleinere Ableitung. Der Adminbereich zeigt Quellbestand, aktive Bilder, Qualitätsausschlüsse, Aufnahmejahrabdeckung sowie TV- und 4K-Eignung.
