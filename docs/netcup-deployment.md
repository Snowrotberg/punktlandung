# Netcup-VPS-Deployment

Punktlandung wird als vollständige Next.js-Anwendung mit API-Routen und separatem WebSocket-Server betrieben. Ein statischer Export per FTPS ist für den aktuellen Funktionsumfang nicht mehr geeignet, weil dadurch insbesondere Online-Räume, Feedback-Versand, Bild-Proxy und anonyme Betriebsmetriken fehlen würden.

Die frühere GitHub-Action für das statische FTPS-Deployment ist deshalb absichtlich deaktiviert. Ein Push nach `main` veröffentlicht die Website nicht mehr automatisch über diesen veralteten Weg.

## Bestandteile der Produktion

- Next.js-Produktionsserver hinter dem vorhandenen HTTPS-Reverse-Proxy
- WebSocket-Server aus `server/index.ts`, ausschließlich an `127.0.0.1` gebunden
- Reverse-Proxy für die öffentliche sichere WebSocket-Verbindung
- PM2 oder der bereits eingerichtete Prozessmanager für beide Prozesse
- dauerhaft beschreibbare Datei für anonyme Betriebsmetriken außerhalb eines austauschbaren Release-Verzeichnisses
- Gmail-App-Passwort für Feedback und interne Wochenberichte

## Erforderliche Prüfungen vor einem Release

```bash
npm ci
npm run typecheck
npm run build
npm run test:ws-hardening
```

Das Deployment darf erst fortgesetzt werden, wenn alle vier Befehle erfolgreich sind. Geheimnisse gehören ausschließlich in die Serverumgebung und niemals in Git oder Build-Artefakte.

## Wichtige Produktionsvariablen

Die vollständige Liste und sichere Beispielwerte stehen in `.env.example`. Vor dem Start müssen insbesondere diese Gruppen konfiguriert sein:

- `NEXT_PUBLIC_APP_URL`, Analytics- und AdSense-Werte
- `FEEDBACK_GMAIL_USER`, `FEEDBACK_GMAIL_APP_PASSWORD`, `FEEDBACK_TO_EMAIL`
- `WS_HOST=127.0.0.1`, erlaubte Origins und Schutzgrenzen
- `USAGE_METRICS_FILE` und `USAGE_REPORT_TO_EMAIL`
- während des geschützten Tests weiterhin `APP_ACCESS_PASSWORD`

## Protokolle und Aufbewahrung

Die Vorlage `ops/logrotate/punktlandung-pm2` begrenzt die PM2-Protokolle auf 14 Tage. Beim geschützten Produktionscheck muss zusätzlich bestätigt werden, dass die Zugriffs- und Fehlerprotokolle des Reverse-Proxys ebenfalls spätestens nach 14 Tagen gelöscht werden.

## Sicherer Release-Ablauf

1. Lokalen Release-Kandidaten vollständig prüfen.
2. Änderungen gemeinsam reviewen, committen und pushen.
3. Auf dem VPS über den bestehenden sicheren Prozess aktualisieren und neu bauen.
4. Next.js- und WebSocket-Prozess kontrolliert neu starten.
5. Prozessstatus, Reverse-Proxy, HTTPS, WebSocket und Logs prüfen.
6. Vollständigen Produktionstest hinter der Passwortsperre durchführen.
7. Die Passwortsperre erst nach ausdrücklicher Launch-Freigabe entfernen.

Die konkreten Serverzugänge und Zugangsbefehle werden bewusst nicht im Repository dokumentiert.

## Einfacher Rollback-Ablauf

Vor jedem Deployment wird der aktuell produktive Commit notiert:

```bash
sudo -u punktapp -H git -C /opt/punktlandung rev-parse HEAD
```

Falls die neue Version trotz der Vorprüfungen nicht stabil läuft, wird genau dieser zuvor notierte Commit wiederhergestellt. Dabei bleibt die Produktionsumgebung einschließlich `.env` unverändert:

```bash
sudo -u punktapp -H bash -lc 'cd /opt/punktlandung && git reset --hard <ROLLBACK_COMMIT> && npm install && npm run build && pm2 reload punktlandung && pm2 reload punktlandung-ws && pm2 save'
```

Danach werden HTTPS-Erreichbarkeit, Zugangssperre, Next.js-Prozess und WebSocket-Prozess erneut geprüft. Ein Rollback-Commit wird niemals geraten, sondern immer aus der unmittelbar vor dem Deployment notierten Commit-ID übernommen.
