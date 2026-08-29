import {
  BadgeCheck,
  CircleUserRound,
  Eye,
  Flag,
  Gamepad2,
  History,
  Images,
  Laptop,
  MapPin,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Target,
  Trophy,
  UserRoundCheck,
  Users
} from "lucide-react";
import type { ReactNode } from "react";
import { ResultMarkerGraphic, ResultRouteGraphic } from "./ResultMapPrimitives";
import styles from "./EditorialExplainers.module.css";

function DiagramFrame({
  id,
  title,
  description,
  children
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <figure className={styles.frame} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <figcaption className={styles.caption}>
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-description`}>{description}</p>
      </figcaption>
      {children}
    </figure>
  );
}

export function GameFlowDiagram() {
  const steps = [
    { label: "Aufgabe ansehen", detail: "Bild, Flagge oder Ortsmotiv erkennen", Icon: Eye },
    { label: "Ort einschätzen", detail: "Hinweise geografisch einordnen", Icon: Target },
    { label: "Tipp setzen", detail: "Pin auf der Weltkarte bestätigen", Icon: MapPin },
    { label: "Auflösung", detail: "Ziel, Entfernung und Punkte vergleichen", Icon: Flag }
  ];

  return (
    <DiagramFrame
      id="game-flow"
      title="Eine Runde auf einen Blick"
      description="Vier Schritte führen von der Aufgabe bis zur nachvollziehbaren Auflösung."
    >
      <ol className={styles.flow} aria-label="Ablauf einer Runde in vier Schritten">
        {steps.map(({ label, detail, Icon }, index) => (
          <li key={label}>
            <Icon aria-hidden="true" />
            <strong><span className={styles.stepNumberInline} aria-hidden="true">{index + 1}</span>{" "}{label}</strong>
            <small>{detail}</small>
          </li>
        ))}
      </ol>
    </DiagramFrame>
  );
}

export function ScoreDiagram() {
  return (
    <DiagramFrame
      id="score-model"
      title="Vom Tipp zur Punktzahl"
      description="Die Linie steht für die gemessene Entfernung zwischen deinem Pin und dem tatsächlichen Ziel."
    >
      <div className={styles.scoreVisual} aria-hidden="true">
        <div className={styles.mapPoint}>
          <ResultMarkerGraphic kind="guess" className={styles.scoreMarker} />
          <span className="punktlandung-map-label punktlandung-map-label-player punktlandung-player-color-0">#1 Dein Tipp</span>
        </div>
        <ResultRouteGraphic label="500 km" />
        <div className={styles.mapPoint}>
          <ResultMarkerGraphic kind="target" className={styles.scoreMarker} />
          <span className="punktlandung-map-label punktlandung-map-label-actual">Ziel</span>
        </div>
      </div>
      <dl className={styles.scoreFacts}>
        <div><dt>Tipp</dt><dd>dein gesetzter Kartenpunkt</dd></div>
        <div><dt>Entfernung</dt><dd>Luftlinie bis zum Ziel</dd></div>
        <div><dt>Beispielwertung</dt><dd><strong>3.816 Punkte</strong> bei 500 km</dd></div>
      </dl>
    </DiagramFrame>
  );
}

export function AccountFlowDiagram() {
  return (
    <DiagramFrame
      id="account-flow"
      title="Gastspiel, Konto, Verlauf und Ranking"
      description="Ein Konto speichert eine Partie dauerhaft. Für eine öffentliche Platzierung gelten zusätzliche Bedingungen."
    >
      <ol className={styles.accountFlow} aria-label="Datenweg einer Gastpartie bis zu einer möglichen Rankingplatzierung">
        <li><CircleUserRound aria-hidden="true" /><span><strong>Als Gast spielen</strong><small>Direkter Start ohne Konto</small></span></li>
        <li><UserRoundCheck aria-hidden="true" /><span><strong>Optional anmelden</strong><small>Abgeschlossene Gastpartie übernehmen</small></span></li>
        <li><History aria-hidden="true" /><span><strong>Privater Spielverlauf</strong><small>Gespeicherte Partie und Rundendetails</small></span></li>
        <li><ShieldCheck aria-hidden="true" /><span><strong>Rankingprüfung</strong><small>Vollständig, technisch geprüft, feste Zeit und öffentliches Profil</small></span></li>
        <li><Trophy aria-hidden="true" /><span><strong>Öffentliches Ranking</strong><small>Bestwert im gewählten Zeitraum und in der Kategorie</small></span></li>
      </ol>
      <p className={styles.branchNote}><BadgeCheck aria-hidden="true" /> Ohne Anmeldung kannst du spielen; ohne spätere Übernahme bleibt das Ergebnis browserbezogen und erscheint nicht öffentlich.</p>
    </DiagramFrame>
  );
}

export function RankingScopeDiagram() {
  return (
    <DiagramFrame
      id="ranking-scope"
      title="So entsteht eine Rankingansicht"
      description="Zeitraum und Kategorie grenzen die Vergleichsgruppe ein; angezeigt wird der passende persönliche Bestwert."
    >
      <div className={styles.rankingFlow}>
        <div><SlidersHorizontal aria-hidden="true" /><strong>Zeitraum</strong><span>Tag · Woche · Monat · Jahr</span></div>
        <span aria-hidden="true">+</span>
        <div><Images aria-hidden="true" /><strong>Kategorie</strong><span>Gesamt oder einzelner Aufgabentyp</span></div>
        <span aria-hidden="true">→</span>
        <div><Trophy aria-hidden="true" /><strong>Bestwert</strong><span>eine Platzierung je öffentlichem Profil</span></div>
      </div>
    </DiagramFrame>
  );
}

export function ModesAndContentDiagram() {
  const modes = [
    { title: "Solo", detail: "allein am eigenen Gerät", Icon: Smartphone },
    { title: "Party", detail: "2–10 Personen an einem Gerät", Icon: Users },
    { title: "Online-Raum", detail: "bis zu 10 Personen auf mehreren Geräten", Icon: Laptop }
  ];
  const categories = ["Städte", "Hauptstädte", "Wahrzeichen", "Landschaften", "Flaggen"];

  return (
    <DiagramFrame
      id="modes-content"
      title="Spielarten und Aufgaben"
      description="Die Spielart bestimmt, wer auf welchem Gerät spielt. Die gewählte Kategorie bestimmt, welche geografischen Hinweise erscheinen."
    >
      <div className={styles.modeGrid} aria-label="Drei Spielarten">
        {modes.map(({ title, detail, Icon }) => (
          <div key={title}><Icon aria-hidden="true" /><strong>{title}</strong><span>{detail}</span></div>
        ))}
      </div>
      <div className={styles.categoryRow} aria-label="Fünf Aufgabenkategorien">
        <Gamepad2 aria-hidden="true" />
        <span>Gemischt</span>
        {categories.map((category) => <span key={category}>{category}</span>)}
      </div>
      <p className={styles.modeNote}><Route aria-hidden="true" /> Alle Spielarten verwenden denselben Kern: Aufgabe ansehen, Pin setzen und Entfernung auswerten.</p>
    </DiagramFrame>
  );
}
