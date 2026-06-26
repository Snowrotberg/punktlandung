# Netcup Deployment

Punktlandung ist fuer den ersten Release als statische Website vorbereitet.

Das bedeutet:

- laeuft auf normalem Netcup-Webhosting
- Deployment ueber GitHub Actions
- kein extra Server noetig
- Solo funktioniert
- Party-Modus am selben Bildschirm funktioniert
- Online-Raeume ueber mehrere Geraete sind in dieser Variante deaktiviert

## Warum keine Online-Raeume?

Online-Raeume brauchen eine gemeinsame Live-Verbindung im Internet. Wenn eine Person auf dem Handy tippt, muss der Laptop einer anderen Person diese Info sofort bekommen. Dafuer braucht man einen WebSocket-Server, eine Datenbank mit Echtzeit-Funktion oder einen aehnlichen Dienst.

Normales Netcup-Webhosting liefert Dateien aus, laesst aber keinen dauerhaft laufenden Spielserver fuer solche Live-Raeume laufen. Deshalb ist die serverlose Version bewusst auf Solo und Party am selben Bildschirm ausgelegt.

## GitHub-Secrets

In GitHub unter `Settings -> Secrets and variables -> Actions` diese Repository-Secrets anlegen:

| Secret | Beispiel | Zweck |
| --- | --- | --- |
| `NETCUP_FTP_SERVER` | `hosting123456.a2f3b.netcup.net` | FTP/FTPS-Server aus dem Netcup CCP/WCP |
| `NETCUP_FTP_USERNAME` | `hosting123456` | FTP-Benutzer |
| `NETCUP_FTP_PASSWORD` | `...` | FTP-Passwort |
| `NETCUP_FTP_SERVER_DIR` | `/httpdocs/punktlandung/` | Zielordner der Domain |

Danach auf `main` pushen oder die GitHub Action `Deploy static frontend to Netcup` manuell starten.

Die Action fuehrt aus:

```bash
npm ci
npm run typecheck
npm run build:static
```

Danach wird der Ordner `out/` per FTPS zu Netcup hochgeladen.

## Lokal pruefen

Entwicklung:

```bash
npm install
npm run dev
```

Statischen Netcup-Build pruefen:

```bash
npm run build:static
```

Die fertigen Dateien liegen danach in `out/`.

Wichtige Routen muessen als Ordner mit `index.html` vorhanden sein, zum Beispiel:

```text
out/solo-modus/index.html
out/party-modus/index.html
out/online-modus/index.html
out/spielen/index.html
out/aufloesung/index.html
out/endergebnis/index.html
```

Der FTPS-Upload muss den kompletten Inhalt von `out/` inklusive aller Unterordner hochladen.

## Spaeter mit Accounts oder Online-Raeumen

Wenn spaeter Accounts, gespeicherte Spielstaende oder Online-Raeume dazukommen sollen, braucht Punktlandung wieder einen Backend-Dienst. Das kann dann z. B. ein kleiner VPS, Supabase, Firebase oder ein anderer Hosted-Service sein.
