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
