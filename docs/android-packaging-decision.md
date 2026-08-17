# Android-Paketierung fuer Punktlandung

Stand: 3. August 2026

## Empfehlung fuer den ersten Release

Die bestehende Next.js-Anwendung bleibt die Produktquelle. Nach Abschluss der
mobilen Browseroptimierung wird sie als installierbare PWA abgenommen und ueber
eine Trusted Web Activity (TWA) in den Play Store gebracht.

Das ist kein Kopieren der Website in eine zweite Codebasis. Die Android-App
oeffnet die verifizierte Produktions-PWA ohne Browser-Chrome. Updates an der
Website stehen dadurch grundsaetzlich auch in der Android-App bereit.

## Warum nicht sofort Capacitor

Capacitor kann in bestehende Webprojekte integriert werden und ist sinnvoll,
wenn native Plugins gebraucht werden. Punktlandung besitzt derzeit aber:

- serverseitige Next.js-Routen,
- einen separaten WebSocket-Server,
- viele remote geladene Bild- und Kartenressourcen,
- noch keine abgegrenzte statische Mobile-Client-Anwendung.

Ein sauber gebuendelter Capacitor-Client wuerde daher eine zusaetzliche
Deployment- und Konfigurationsschicht schaffen. Fuer einen ersten Store-Release
liefert TWA schneller denselben Stand wie der mobile Browser.

## Wechselkriterien zu Capacitor oder nativ

Neu bewerten, sobald mindestens eines davon konkret erforderlich ist:

- native Push-Benachrichtigungen mit komplexer Hintergrundlogik,
- native Google-/Apple-Anmeldedialoge statt Browserredirect,
- In-App-Kaeufe,
- Kamera, Dateien, Teilen oder Haptik als Kernfunktion,
- belastbares Offline-Spiel,
- Hintergrundsynchronisierung ausserhalb des Browserlebenszyklus.

Backend-API, Account-ID, Spiel-ID und Rankingmodell bleiben bei einem spaeteren
Wechsel unveraendert.

## Bereits vorbereitet

- `app/manifest.ts` erzeugt `/manifest.webmanifest`.
- 192- und 512-Pixel-PWA-Icons sind vorhanden.
- Appname, Start-URL, Scope, Standalone-Darstellung, Sprache und Farben sind
  definiert.
- Produktionsbuild erzeugt das Manifest erfolgreich.

## Noch autonom vorzubereiten

- Installierbarkeit ueber HTTPS und auf Android pruefen.
- Service-Worker-Strategie festlegen, ohne dynamische Spielzustaende oder
  veraltete Antworten zu cachen.
- Offline-Fallback fuer reine Navigationsfehler entwerfen.
- Auth-Callback-Pfade fuer Web und App im API-Vertrag reservieren.
- Netzwerkverlust und Rueckkehr im WebSocket-Spiel testen.
- Mobile Safe Areas und Standalone-Anzeige pruefen.

## Spaeter benoetigte Entscheidungen

- Android-Paketname, vorgeschlagen etwa `app.punktlandung.game`.
- Play-Console-Inhaber und Entwicklername.
- Signaturschluessel und sichere Aufbewahrung.
- Google-OAuth-Android-Client mit Paketname und Zertifikat-Fingerprint.
- Digital Asset Links zwischen `punktlandung.app` und der signierten App.
- Datenschutzerklaerung und Play-Data-Safety-Angaben.

## TWA-Veroeffentlichungskette

1. PWA auf der kanonischen HTTPS-Domain abnehmen.
2. Paketname und Signaturschluessel festlegen.
3. TWA-Projekt mit Bubblewrap oder PWABuilder erzeugen.
4. `/.well-known/assetlinks.json` mit echtem Paketnamen und echtem
   Zertifikat-Fingerprint veroeffentlichen.
5. App lokal und im geschlossenen Play-Test pruefen.
6. Loginredirect, WebSocket, Zurueck-Taste, Rotation und Prozesswiederaufnahme
   testen.
7. Erst danach in Produktion ausrollen.

## Anbieterwirkung

TWA verwendet den Browser und die Webintegration. Deshalb funktionieren
Firebase Auth und Supabase Auth grundsaetzlich beide. Android allein erzwingt
keinen Anbieterwechsel. Ein spaeterer nativer Kotlin-Client waere ein staerkeres
Argument fuer Firebase; relationale Rankings und PostGIS bleiben Argumente fuer
Supabase.

## Primaerquellen

- Android TWA: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
- Android TWA Quick Start: https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2
- Capacitor: https://capacitorjs.com/docs
- Supabase Mobile Deep Links: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- Firebase Cordova OAuth-Hinweise: https://firebase.google.com/docs/auth/web/cordova
