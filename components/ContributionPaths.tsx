import { Lightbulb, MessageSquareWarning } from "lucide-react";
import Link from "next/link";
import styles from "./ContributionPaths.module.css";

type ContributionPathsProps = {
  mode: "feedback" | "idea" | "both";
};

const paths = {
  feedback: {
    eyebrow: "Frage offen oder etwas stimmt nicht?",
    title: "Direktes Feedback senden",
    copy: "Frag nach, melde ein falsches Bild oder beschreibe ein technisches Problem direkt an das Punktlandung-Team.",
    href: "/feedback",
    action: "Feedback senden",
    Icon: MessageSquareWarning
  },
  idea: {
    eyebrow: "Du hast eine Idee für eine Funktion?",
    title: "Idee mit der Community teilen",
    copy: "Teile deinen Vorschlag öffentlich, sammle Stimmen und verfolge deine Idee auf der Roadmap.",
    href: "/community#vorschlagen",
    action: "Idee vorschlagen",
    Icon: Lightbulb
  }
} as const;

function PathCard({ type }: { type: keyof typeof paths }) {
  const path = paths[type];
  return (
    <article className={styles.card}>
      <span className={styles.icon}><path.Icon aria-hidden="true" /></span>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>{path.eyebrow}</span>
        <h2>{path.title}</h2>
        <p>{path.copy}</p>
      </div>
      <Link href={path.href}>{path.action}<span aria-hidden="true">›</span></Link>
    </article>
  );
}

export function ContributionPaths({ mode }: ContributionPathsProps) {
  if (mode === "both") {
    return (
      <aside className={`${styles.panel} ${styles.both}`} aria-labelledby="contact-paths-heading">
        <div className={styles.heading}>
          <span>Noch eine Frage oder Anregung?</span>
          <h2 id="contact-paths-heading">Sag uns, was dir weiterhilft</h2>
          <p>Schick uns eine Frage oder Fehlermeldung direkt – oder teile eine konkrete Idee öffentlich mit der Community.</p>
        </div>
        <div className={styles.grid}><PathCard type="feedback" /><PathCard type="idea" /></div>
      </aside>
    );
  }

  return <aside className={styles.panel}><PathCard type={mode} /></aside>;
}
