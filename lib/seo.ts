import type { MetadataRoute } from "next";

export const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const siteName = "Punktlandung";

export const defaultDescription =
  "Punktlandung ist ein kostenloses Geo-Guessing-Spiel auf Deutsch: Bild ansehen, Ort erraten, Pin setzen und Punkte sammeln - solo oder als Partyspiel.";

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
    path: "/geoguessr-alternative-deutsch",
    title: "GeoGuessr Alternative Deutsch - Punktlandung kostenlos spielen",
    description:
      "Punktlandung ist eine deutschsprachige GeoGuessr-Alternative fuer Browser, Party-Runden und schnelle Geografie-Quizspiele ohne Anmeldung.",
    priority: 0.9,
    changeFrequency: "monthly"
  },
  {
    path: "/geografie-spiel",
    title: "Geografie-Spiel online - Orte, Laender und Wahrzeichen erraten",
    description:
      "Spiele ein kostenloses Geografie-Spiel im Browser: erkenne Orte, Staedte, Landschaften, Flaggen und Wahrzeichen und sammle Punkte.",
    priority: 0.85,
    changeFrequency: "monthly"
  },
  {
    path: "/orte-erraten-spiel",
    title: "Orte erraten Spiel - Bild ansehen und Standort tippen",
    description:
      "Beim Orte-erraten-Spiel Punktlandung setzt du deinen Pin auf die Karte und bekommst Punkte nach Entfernung zum richtigen Standort.",
    priority: 0.85,
    changeFrequency: "monthly"
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
    path: "/kostenloses-geoguessing-spiel",
    title: "Kostenloses GeoGuessing-Spiel - Punktlandung im Browser",
    description:
      "Punktlandung ist ein kostenloses GeoGuessing-Spiel fuer den Browser mit Solo-Modus, Party-Modus und Kategorien wie Staedte, Flaggen und Wahrzeichen.",
    priority: 0.8,
    changeFrequency: "monthly"
  },
  {
    path: "/infos",
    title: "Punktlandung Infos - Geo-Quiz, FAQ und wichtige Seiten",
    description:
      "Informationen zu Punktlandung: kostenloses Geo-Guessing-Spiel, FAQ, Kategorien und wichtige Seiten zum deutschsprachigen Geo-Quiz.",
    priority: 0.75,
    changeFrequency: "monthly"
  },
  {
    path: "/faq",
    title: "Punktlandung FAQ - Fragen zum kostenlosen Geo-Quiz",
    description:
      "Antworten zu Punktlandung: kostenlos spielen, ohne Anmeldung starten, Kategorien waehlen und als Geo-Quiz oder Partyspiel nutzen.",
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
      "Punktlandung ist ein deutschsprachiges Geo-Guessing-Spiel fuer den Browser. Du siehst ein Bild oder eine Aufgabe, erratest den Ort auf der Karte und bekommst Punkte nach Entfernung."
  },
  {
    question: "Ist Punktlandung kostenlos?",
    answer:
      "Ja. Punktlandung ist als kostenlos spielbares Browser-Spiel vorbereitet und kann ohne Kauf direkt gestartet werden."
  },
  {
    question: "Ist Punktlandung eine deutsche GeoGuessr-Alternative?",
    answer:
      "Punktlandung ist eine deutschsprachige Alternative fuer Spieler, die ein schnelles Geo-Quiz mit Orten, Staedten, Landschaften, Flaggen und Wahrzeichen suchen."
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
