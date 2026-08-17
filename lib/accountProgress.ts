export const gameMilestoneTargets = [1, 5, 10, 25, 50, 100, 250, 500] as const;
export const pointMilestoneTargets = [25_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000] as const;

export type PlayerInsightStats = {
  count: number;
  verifiedCount: number;
  averageRoundScore: number;
  dailyRanking: { rank: number; participants: number } | null;
  weeklyRanking: { rank: number; participants: number } | null;
  strongestCategory: { category: string; value: number; games: number } | null;
};

export type PlayerInsight = { eyebrow: string; title: string; body: string };

type InsightVariant = (stats: PlayerInsightStats) => PlayerInsight;

function dailyVariantIndex(accountId: string, state: string, now: number, length: number): number {
  const day = new Date(now).toISOString().slice(0, 10);
  let hash = 2166136261;
  for (const character of `${accountId}:${state}:${day}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

function choose(accountId: string, state: string, now: number, variants: InsightVariant[], stats: PlayerInsightStats): PlayerInsight {
  return variants[dailyVariantIndex(accountId, state, now, variants.length)](stats);
}

export function buildPlayerInsight(accountId: string, stats: PlayerInsightStats, now = Date.now()): PlayerInsight {
  if (stats.count === 0) return choose(accountId, "new", now, [
    () => ({ eyebrow: "Dein Start", title: "Die Welt wartet auf deinen ersten Tipp", body: "Schon nach der ersten gewerteten Partie siehst du hier, welche Kategorie dir besonders liegt." }),
    () => ({ eyebrow: "Bereit zur ersten Runde", title: "Deine Weltreise beginnt jetzt", body: "Spiele deine erste Partie und fülle dein Profil mit persönlichen Bestwerten." }),
    () => ({ eyebrow: "Noch unentdeckt", title: "Welcher Geo-Typ steckt in dir?", body: "Deine erste gewertete Partie zeigt, ob Städte, Flaggen oder Wahrzeichen deine Stärke sind." })
  ], stats);

  if (stats.verifiedCount === 0) return choose(accountId, "unranked", now, [
    () => ({ eyebrow: "Fast geschafft", title: "Deine erste Ranking-Wertung wartet", body: "Schließe eine vollständige Partie ab, damit deine persönliche Stärke sichtbar wird." }),
    () => ({ eyebrow: "Nächster Halt: Ranking", title: "Mach dein erstes Ergebnis vergleichbar", body: "Eine vollständig geprüfte Partie genügt für deine erste Platzierung." })
  ], stats);

  if (stats.dailyRanking?.rank === 1) return choose(accountId, "daily-first", now, [
    () => ({ eyebrow: "Heute in Bestform", title: "Du führst das Tagesranking", body: "Verteidige Platz 1 mit einer weiteren starken Partie." }),
    (value) => ({ eyebrow: "Tagesspitze", title: "Heute kommt niemand an dir vorbei", body: `Du liegst vor ${Math.max(0, (value.dailyRanking?.participants ?? 1) - 1)} weiteren Teilnehmenden. Hält deine Serie?` }),
    () => ({ eyebrow: "Platz an der Sonne", title: "Die Tageskrone gehört dir", body: "Noch eine konzentrierte Partie kann deinen Vorsprung ausbauen." })
  ], stats);

  if (stats.dailyRanking && stats.dailyRanking.rank <= 3) return choose(accountId, "daily-podium", now, [
    (value) => ({ eyebrow: "Heute auf dem Podium", title: `Platz ${value.dailyRanking!.rank} ist erst der Anfang`, body: "Eine gute Runde kann dich heute noch ganz nach oben bringen." }),
    (value) => ({ eyebrow: "Spitze in Reichweite", title: `Nur ${value.dailyRanking!.rank - 1} ${value.dailyRanking!.rank === 2 ? "Platz" : "Plätze"} bis ganz nach oben`, body: "Dein nächster Versuch kann das Tagesranking drehen." })
  ], stats);

  if (stats.weeklyRanking?.rank === 1) return choose(accountId, "weekly-first", now, [
    () => ({ eyebrow: "Diese Woche in Bestform", title: "Diese Woche führt kein Weg an dir vorbei", body: "Halte deinen Vorsprung und setze den nächsten Bestwert." }),
    () => ({ eyebrow: "Diese Woche ganz vorn", title: "Du gibst aktuell das Tempo vor", body: "Eine weitere gewertete Partie festigt deinen Wochenplatz 1." }),
    () => ({ eyebrow: "Starke Woche", title: "Die Wochenspitze gehört dir", body: "Bleib konzentriert und verteidige deinen ersten Platz." })
  ], stats);

  if (stats.weeklyRanking && stats.weeklyRanking.rank <= 3) return choose(accountId, "weekly-podium", now, [
    (value) => ({ eyebrow: "Diese Woche in Bestform", title: `Du stehst auf Wochenplatz ${value.weeklyRanking!.rank}`, body: "Mit einer weiteren Partie ist die Spitze in Reichweite." }),
    () => ({ eyebrow: "Starke Woche", title: "Du spielst vorne mit", body: "Jetzt zählt jede präzise Runde auf dem Weg zur Wochenspitze." }),
    (value) => ({ eyebrow: "Wochenspitze in Reichweite", title: `Aktuell Platz ${value.weeklyRanking!.rank}`, body: "Eine starke Partie kann deine Wochenplatzierung noch verbessern." })
  ], stats);

  if (stats.averageRoundScore >= 4_000) return choose(accountId, "precision", now, [
    (value) => ({ eyebrow: "Präzisionsprofi", title: `${value.averageRoundScore.toLocaleString("de-DE")} Punkte pro Runde`, body: "Du spielst bereits auf sehr hohem Niveau. Wie weit kannst du den Schnitt noch treiben?" }),
    () => ({ eyebrow: "Messerscharf", title: "Deine Tipps landen erstaunlich nah", body: "Bleib konzentriert und jage den nächsten persönlichen Bestwert." })
  ], stats);

  if (stats.strongestCategory) return choose(accountId, "category", now, [
    (value) => ({ eyebrow: "Deine aktuelle Stärke", title: value.strongestCategory!.category, body: `Ø ${value.strongestCategory!.value.toLocaleString("de-DE")} Ranking-Punkte aus ${value.strongestCategory!.games} ${value.strongestCategory!.games === 1 ? "Partie" : "Partien"}. Kannst du den Wert noch steigern?` }),
    (value) => ({ eyebrow: "Hier kennst du dich aus", title: value.strongestCategory!.category, body: "Diese Kategorie liegt dir aktuell am besten. Zeit, den Vorsprung auszubauen." }),
    (value) => ({ eyebrow: "Dein Spezialgebiet", title: value.strongestCategory!.category, body: `Mit Ø ${value.strongestCategory!.value.toLocaleString("de-DE")} Ranking-Punkten ist das gerade dein stärkstes Terrain.` })
  ], stats);

  if (stats.count >= 10) return choose(accountId, "experienced", now, [
    (value) => ({ eyebrow: "Weltenbummler", title: `${value.count} Partien voller neuer Orte`, body: "Du kennst die Welt inzwischen gut – Zeit für den nächsten persönlichen Rekord." }),
    () => ({ eyebrow: "Erfahrung zahlt sich aus", title: "Dein Geo-Profil nimmt Form an", body: "Jede weitere Partie macht deine Stärken und Fortschritte aussagekräftiger." })
  ], stats);

  return choose(accountId, "developing", now, [
    () => ({ eyebrow: "Auf gutem Kurs", title: "Dein nächster Bestwert ist in Reichweite", body: "Jede weitere Partie schärft dein Profil und macht deine Stärken sichtbarer." }),
    (value) => ({ eyebrow: "Profil im Aufbau", title: `Schon ${value.count} ${value.count === 1 ? "Partie" : "Partien"} gesammelt`, body: "Bleib dran – mit jeder Runde wird dein persönliches Spielprofil genauer." }),
    () => ({ eyebrow: "Nächste Runde, nächster Sprung", title: "Dein Potenzial ist noch lange nicht ausgereizt", body: "Teste eine andere Kategorie oder erhöhe die Schwierigkeit für neue Bestwerte." })
  ], stats);
}

export function nextMilestone(current: number, targets: readonly number[]) {
  const target = targets.find((value) => value > current) ?? null;
  return target == null ? null : { current, target, progress: Math.min(100, Math.round((current / target) * 100)) };
}

export const gameProgressBands = [
  { label: "Noch keine gewertete Partie", min: 0, max: 0 },
  { label: "1–4 Partien", min: 1, max: 4 },
  { label: "5–9 Partien", min: 5, max: 9 },
  { label: "10–24 Partien", min: 10, max: 24 },
  { label: "25–49 Partien", min: 25, max: 49 },
  { label: "50+ Partien", min: 50, max: Number.POSITIVE_INFINITY }
] as const;

export const pointProgressBands = [
  { label: "Noch keine Ranking-Punkte", min: 0, max: 0 },
  { label: "1–24.999 Punkte", min: 1, max: 24_999 },
  { label: "25.000–99.999 Punkte", min: 25_000, max: 99_999 },
  { label: "100.000–249.999 Punkte", min: 100_000, max: 249_999 },
  { label: "250.000–499.999 Punkte", min: 250_000, max: 499_999 },
  { label: "500.000+ Punkte", min: 500_000, max: Number.POSITIVE_INFINITY }
] as const;

export function distributeProgress(values: number[], bands: readonly { label: string; min: number; max: number }[]) {
  return bands.map((band) => ({ ...band, count: values.filter((value) => value >= band.min && value <= band.max).length }));
}
