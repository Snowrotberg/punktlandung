# Punktlandung

Kostenloses Geo-Quiz-Spiel mit Next.js, MapLibre und Leaflet.

Punktlandung wird als vollstaendige Serveranwendung betrieben:

- Solo
- Party-Modus am selben Bildschirm
- Online-Raeume ueber den separaten WebSocket-Server
- Next.js- und WebSocket-Prozesse auf dem Netcup-VPS

## Entwicklung

```bash
npm install
npm run dev
```

Das startet lokal:

- Next.js auf `http://localhost:3000`

## Deployment

Die Netcup/GitHub-Deployment-Anleitung liegt in [docs/netcup-deployment.md](docs/netcup-deployment.md).

Kurzfassung: Der gepruefte Release-Commit wird auf dem Netcup-VPS aktualisiert, dort als vollstaendige Next.js-Anwendung gebaut und anschliessend zusammen mit dem WebSocket-Server kontrolliert ueber PM2 neu geladen. Das fruehere statische FTPS-Deployment ist deaktiviert.

## SEO und AI-Suche

Die Ziele fuer klassische SEO, AI-Suche/GEO, strukturierte Daten, Sitemap, robots.txt, Landingpages und Messung liegen in [docs/seo-geo-roadmap.md](docs/seo-geo-roadmap.md). Diese Roadmap ist als abarbeitbare Checkliste fuer die naechsten Optimierungsschritte gedacht.

Wichtig fuer den Livegang: Sobald die finale Domain feststeht, muss `NEXT_PUBLIC_APP_URL` im Deployment gesetzt werden, z. B. `https://deine-domain.de`. Daraus entstehen Canonical URLs, OpenGraph-URLs, `sitemap.xml`, `robots.txt` und JSON-LD. Ohne gesetzte Domain nutzt der lokale Build bewusst `http://localhost:3000`.

## Werbung

Punktlandung ist AdSense-ready vorbereitet, aber standardmaessig deaktiviert. Die Slots liegen bewusst in kontrollierten Bereichen: Startscreen und Lobby/Einstellungen bekommen seitliche Desktop-Rails, die aktive Tipp-Runde bekommt nur links unten einen kompakten Slot als Gegenstueck zur Tippkarte. Desktop, Laptop/PC und TV bleiben ohne Footer-Ads auf einen gefuellten Screen ausgelegt.

Aktivierung:

- `NEXT_PUBLIC_ADSENSE_ENABLED=true`
- `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-...`
- passende Slot-IDs in `.env`
- `public/ads.txt` mit der echten Publisher-ID aktualisieren
- Consent/CMP rechtlich final klaeren
