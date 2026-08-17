# Ad-blocking recovery

Punktlandung verwendet keine eigene Köderdatei-Erkennung. Die Mitteilung wird in Google AdSense unter **Privacy & messaging > Ad blocking recovery** erstellt, als dezente und schließbare Nachricht veröffentlicht und anschließend über die dort ausgegebene URL aktiviert:

```env
NEXT_PUBLIC_ADBLOCK_RECOVERY_ENABLED=true
NEXT_PUBLIC_ADBLOCK_RECOVERY_TAG_URL=https://fundingchoicesmessages.google.com/...
```

Die Anwendung akzeptiert ausschließlich HTTPS-URLs dieses Google-Hosts. Aktive Spielrunden, Anmeldung und Rechtstexte laden die Mitteilung nicht. Schließen oder Ablehnen sperrt keine Kernfunktion. Consent-Einstellungen und Adblock-Mitteilung bleiben getrennte Vorgänge.
