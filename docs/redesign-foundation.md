# Redesign-Fundament

Die erste technische Redesign-Schicht liegt isoliert unter `components/redesign`. Solange keine bestehende Seite diese Bausteine importiert, verändert sie die Live-Oberfläche nicht.

## Enthaltene Bausteine

- `RedesignShell`, `RedesignHeader` und `RedesignFooter`
- `RedesignButton` und `RedesignButtonLink` in den Tönen `primary`, `secondary`, `quiet` und `text`
- `Surface` für Karten und Inhaltsflächen
- `SegmentGroup` für Modus-, Zeit-, Runden-, Schwierigkeits- und Regelwahl
- `PlayerAvatar` mit stabiler Spielerpalette
- `ScoreBar` mit proportionaler Füllung von Violett über Blau zu Mint
- `RedesignAdFrame` als Layoutplatzhalter für die vorhandene Anzeigenlogik

## Gestaltungslogik

- Mint kennzeichnet primäre Aktionen und aktive Auswahlzustände.
- Funktions- und Inhaltsicons sind mintgrün und dienen als kompakte Orientierung neben Bedienelementen oder Kartenüberschriften. Globale Aktionsicons im Header bleiben weiß. Große Seitenüberschriften erhalten keine rein dekorativen Icons.
- Flächen bleiben dunkel und ruhig; Konturen bilden die Hierarchie statt zusätzlicher Effekte.
- Reine Inhaltsflächen verwenden `--pl-content-surface` mit 50 Prozent Deckkraft. Interaktive Karten, Auswahlfelder und Buttons verwenden eine vollständig deckende Aktionsfläche (`--pl-action-surface` beziehungsweise `--pl-button-surface`). Tabellenköpfe und verschachtelte Bedienelemente dürfen sich ebenfalls mit einer deckenden Fläche abheben.
- Das Grid hat 56 Pixel Abstand. Mint- und Violett-Verläufe driften langsam und werden bei `prefers-reduced-motion` angehalten.
- Buttons haben dieselbe Grundgeometrie. Die Wichtigkeit entsteht über Fläche und Farbe, nicht über unterschiedliche Radien.
- Spieler 1 ist Rot, Spieler 2 Blau. Die weiteren acht Farben sind stabil definiert.

## Integrationsregel

Jede bestehende Seite wird als eigene vertikale Scheibe migriert. Spiellogik, WebSocket-Protokoll und gespeicherte Sitzungen werden nicht innerhalb eines rein visuellen Commits verändert.
