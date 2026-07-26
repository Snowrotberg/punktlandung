# Manuelle Pre-Launch-Prüfungen

Diese Punkte lassen sich nicht allein durch den Quellcode bestätigen und müssen vor der öffentlichen Freischaltung tatsächlich erledigt oder geprüft werden.

## Datenschutz und Aufbewahrung

- [x] Vertrag zur Auftragsverarbeitung mit netcup im Kundenkonto abgeschlossen beziehungsweise bestätigt.
- [x] PM2-Logrotation aus `ops/logrotate/punktlandung-pm2` auf dem VPS installiert und aktiv.
- [x] Aufbewahrung der Reverse-Proxy-Protokolle auf höchstens 14 Tage geprüft.
- [x] Gmail-Löschroutine für Feedbacknachrichten nach spätestens 180 Tagen eingerichtet.
- [x] GA4-Aufbewahrung für Ereignis- und Nutzerdaten auf jeweils zwei Monate eingestellt.

## Google CMP, Analytics und AdSense

- [x] GA4-Mess-ID im Projekt vorbereitet.
- [x] Google-Einwilligungsmodus für Werbung und Analytics aktiviert.
- [x] Drei Auswahlmöglichkeiten in der CMP vorgesehen: Einwilligen, Nicht einwilligen und Optionen verwalten.
- [x] Sensible Standardkategorien sowie Alkohol und Glücksspiel in AdSense blockiert.
- [x] CMP-Mitteilung für `punktlandung.app` veröffentlicht und der Website zugeordnet.
- [ ] Einwilligen, Ablehnen, Optionen verwalten und erneutes Öffnen über „Cookies“ in Produktion getestet.
- [ ] AdSense-Websiteprüfung nach Entfernung der Passwortsperre abgeschlossen.
- [ ] Eigene Anzeigen niemals anklicken.

## Abschluss

- [ ] Pflichtlinks und Lizenzkatalog in der geschützten Produktionsversion geprüft.
- [ ] Vollständige Partie in Solo-, Party- und Online-Modus erfolgreich getestet.
- [ ] Feedback-Versand in Produktion erfolgreich getestet.
- [ ] Öffentliche Freischaltung ausdrücklich bestätigt.
