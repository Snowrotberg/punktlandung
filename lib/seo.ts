import type { MetadataRoute } from "next";

export const siteUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://punktlandung.app").replace(/\/$/, "");

export const siteName = "Punktlandung";

export const defaultDescription =
  "Punktlandung ist ein kostenloses deutschsprachiges Geografie-Partyspiel im Browser. Errate Städte, Hauptstädte, Wahrzeichen, Landschaften und Flaggen - solo oder gemeinsam mit Freunden, ohne Anmeldung.";

export const ogImage = "/og-punktlandung.jpg";

export const seoRoutes = [
  {
    path: "/",
    title: "Punktlandung - kostenloses Geo-Guessing-Spiel auf Deutsch",
    description: defaultDescription,
    priority: 1,
    changeFrequency: "weekly"
  },
  {
    path: "/partyspiel-geografie",
    title: "Geografie-Partyspiel - Punktlandung fuer Gruppen",
    description:
      "Punktlandung eignet sich als Geografie-Partyspiel fuer Gruppen am selben Bildschirm: Namen eintragen, Kategorie waehlen und gemeinsam Orte tippen.",
    priority: 0.8,
    changeFrequency: "monthly"
  },
  {
    path: "/infos",
    title: "Über Punktlandung - Spielidee, Inhalte und Web-Version",
    description:
      "Hintergründe zu Punktlandung: Spielidee, redaktionell gepflegte Inhalte, kostenlose Web-Version und Finanzierung des Projekts.",
    priority: 0.75,
    changeFrequency: "monthly"
  },
  {
    path: "/faq",
    title: "Hilfe & Infos zu Punktlandung - Spiel, Konto und Aufgaben",
    description:
      "Hilfe und Informationen zu Punktlandung: Spielablauf, Punkte, Konto, Rankings, Orte, Quellen und gemeinsame Partien verständlich erklärt.",
    priority: 0.7,
    changeFrequency: "monthly"
  },
  {
    path: "/faq/rankings",
    title: "Punktlandung Konto, Spielverlauf und Rankings erklärt",
    description:
      "Ohne Anmeldung spielen, Partien im Konto speichern und nachvollziehen, welche Ergebnisse bei Punktlandung öffentlich gewertet werden.",
    priority: 0.7,
    changeFrequency: "monthly"
  },
  {
    path: "/so-funktioniert-punktlandung",
    title: "Wie funktioniert Punktlandung? Spielablauf und Punkte",
    description:
      "So funktioniert Punktlandung: Ort erkennen, Tipp auf der Karte setzen und bis zu 5.000 Punkte nach Entfernung sammeln.",
    priority: 0.75,
    changeFrequency: "monthly"
  },
  {
    path: "/ortskatalog",
    title: "Welche Orte und Aufgaben gibt es bei Punktlandung?",
    description:
      "Welche Inhalte bietet Punktlandung? Übersicht über spielbare Orte, Flaggen, Kategorien, Länderabdeckung, Bildauswahl und Quellen.",
    priority: 0.7,
    changeFrequency: "monthly"
  },
  {
    path: "/lizenzen",
    title: "Punktlandung Lizenzen und Quellen",
    description: "Quellen und Lizenzhinweise fuer Karten, Laenderdaten und Bilder in Punktlandung.",
    priority: 0.3,
    changeFrequency: "yearly"
  },
  {
    path: "/datenschutz",
    title: "Datenschutz - Punktlandung",
    description: "Datenschutzhinweise fuer Punktlandung.",
    priority: 0.2,
    changeFrequency: "yearly"
  },
  {
    path: "/impressum",
    title: "Impressum - Punktlandung",
    description: "Impressum und Betreiberangaben fuer Punktlandung.",
    priority: 0.2,
    changeFrequency: "yearly"
  }
] satisfies Array<{
  path: string;
  title: string;
  description: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}>;

export const faqItems = [
  {
    question: "Was ist Punktlandung?",
    answer:
      "Punktlandung ist ein Geografie-Spiel im Browser: Du siehst ein Bild oder eine Aufgabe, setzt deinen Tipp selbst auf der Weltkarte und bekommst Punkte nach Entfernung."
  },
  {
    question: "Ist Punktlandung kostenlos?",
    answer:
      "Ja. Punktlandung ist als kostenlos spielbares Browser-Spiel vorbereitet und kann ohne Kauf direkt gestartet werden."
  },
  {
    question: "Ist Punktlandung eine deutsche GeoGuessr-Alternative?",
    answer:
      "Ja. Punktlandung ist eine eigenständig entwickelte, deutschsprachige Alternative mit Orten, Staedten, Landschaften, Flaggen und Wahrzeichen."
  },
  {
    question: "Kann man Punktlandung ohne Anmeldung spielen?",
    answer:
      "Ja. Der Solo-Modus und der Party-Modus am selben Bildschirm sind ohne Anmeldung nutzbar."
  },
  {
    question: "Eignet sich Punktlandung als Partyspiel?",
    answer:
      "Ja. Im Party-Modus koennen mehrere Personen am selben Bildschirm mitspielen, Namen eintragen und nacheinander ihre Tipps abgeben."
  },
  {
    question: "Welche Kategorien gibt es?",
    answer:
      "Punktlandung bietet Kategorien wie Gemischt, Wahrzeichen, Staedte, Landschaften, Flaggen und Hauptstaedte."
  }
] as const;

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}
