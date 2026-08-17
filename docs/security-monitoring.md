# Sicherheitsüberwachung

Punktlandung verwendet bewusst eine kleine, mehrschichtige Überwachung statt permanenter Vollscans.

## Laufende Prüfungen

- Die GitHub Action `Daily production security monitor` läuft einmal täglich und manuell auf Abruf.
- Sie prüft HTTPS, kanonische URLs, zentrale Sicherheitsheader, erwartete Kernelemente, fremde Script- und Formularziele, DNS und die Restlaufzeit des TLS-Zertifikats.
- Bei einem Fehler wird das bestehende GitHub-Issue mit demselben Monitor-Titel ergänzt oder einmalig ein neues erstellt.
- Visuelle Screenshots können bei einer manuellen Browser-Abnahme mit deaktivierten Animationen und Anzeigen ergänzt werden. Sie sind nur ein Zusatzsignal; DOM-, Header-, Ressourcen- und Hashprüfungen bleiben maßgeblich.

## Release-Integrität

`npm run build` erzeugt nach dem Next.js-Build `.next/integrity-manifest.json` mit SHA-256-Prüfsummen. Auf dem VPS kann `npm run security:verify` diese Dateien gegen das Manifest prüfen. Beispiel-Units liegen unter `ops/security/`; der Timer ist ebenfalls auf einmal täglich begrenzt.

Das Sicherheitslog gehört nach `/var/log/punktlandung/`, nicht in ein weböffentliches Verzeichnis. Es darf keine Passwörter, Tokens, Cookies oder vollständigen Formulareingaben enthalten und sollte durch Logrotate zeitlich begrenzt werden.

## CSP-Rollout

`PUNKTLANDUNG_CSP_MODE=report-only` ist der sichere Ausgangspunkt. Meldungen gehen sanitisiert und rate-limitiert an `/api/security/csp-report`. Erst wenn Karten, Wikimedia-Bilder, Supabase, CMP, Analytics und AdSense in Produktion ohne legitime Verstöße funktionieren, wird auf `enforce` umgestellt.

## Grenzen

Eine vollständig kopierte Seite auf einer beliebigen fremden Domain ist ohne Verbindung zur Originalseite nicht zuverlässig automatisch auffindbar. Exakte Auth-Redirects, der sichtbare Domainhinweis, DNS-/Zertifikatsüberwachung, SPF/DKIM/DMARC sowie ein dokumentierter Melde- und Takedown-Prozess begrenzen dieses Risiko.
