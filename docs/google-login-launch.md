# Google-Anmeldung vor dem Livegang

Die Anwendung ist fuer Google OAuth vorbereitet. Der Login-Button bleibt absichtlich verborgen, bis der Google-Provider im Supabase-Projekt aktiv ist.

## Google Cloud

1. In Google Cloud einen OAuth-Client vom Typ **Webanwendung** anlegen.
2. Als autorisierte Weiterleitungs-URI exakt eintragen:
   `https://nlksmwdkvhusbxnkifyp.supabase.co/auth/v1/callback`
3. Client-ID und Client-Secret sicher bereithalten. Das Secret gehoert weder ins Repository noch in eine `NEXT_PUBLIC_`-Variable.

## Supabase

1. Unter **Authentication > Providers > Google** den Provider aktivieren.
2. Google Client-ID und Client-Secret dort hinterlegen.
3. Unter **Authentication > URL Configuration** die produktive Site URL auf `https://punktlandung.app` setzen.
4. Folgende Redirect URLs erlauben:
   - `https://punktlandung.app/auth/callback`
   - `http://localhost:3000/auth/callback` ausschliesslich fuer lokale Abnahmetests

Produktiv keine Wildcards und keine zusaetzlichen Hostnamen eintragen. `www.punktlandung.app` leitet vor dem Login auf die kanonische Domain um.

## Anwendung und Deployment

Nach aktivem Supabase-Provider in der jeweiligen Umgebung setzen:

```env
NEXT_PUBLIC_APP_URL=https://punktlandung.app
SUPABASE_GOOGLE_LOGIN_ENABLED=true
```

Danach Anmeldung, Konto-Neuanlage, Abbruch, Abmeldung und erneute Anmeldung jeweils mit Google testen. Beim Login wird die Google-Kontoauswahl bewusst erneut angezeigt, damit private und geschaeftliche Konten nicht versehentlich verwechselt werden.
