# Supabase-Migrationen

Diese Migrationen sind die versionierte Quelle der Wahrheit fuer das
Punktlandung-Backend. Sie werden nicht durch manuelles Anlegen von Tabellen im
Dashboard ersetzt.

## Sicherheitsmodell

- Supabase Auth bestaetigt nur die Identitaet.
- Browserrollen (`anon`, `authenticated`) haben keinen direkten Zugriff auf
  Anwendungs-, Spiel- oder Rankingtabellen.
- Die Next.js-API validiert Sitzung, Eigentum und Eingaben und greift erst dann
  serverseitig mit `service_role` zu.
- RLS ist fuer alle Anwendungstabellen aktiv und besitzt absichtlich keine
  Browser-Policies. Explizite Grants bilden eine zweite Sperrschicht.
- Der `service_role`-/Secret-Key darf ausschliesslich als Server-Secret
  hinterlegt werden und niemals in `NEXT_PUBLIC_*`, Git oder Client-Code.

## Reihenfolge

1. Migration im isolierten Supabase-Projekt anwenden.
2. Security Advisor pruefen.
3. Adapter-Vertragstests gegen das isolierte Projekt ausfuehren.
4. Erst danach Accounts intern aktivieren.
5. Gewertete Spiele und Rankings bleiben bis zum separaten Last- und
   Manipulationstest deaktiviert.
