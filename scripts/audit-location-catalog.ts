import { builtInLocations } from "../data/locations";
import { locationDifficultyMap } from "../lib/locationDifficulty";

const prohibitedCuratedFilePatterns = [
  /\b(person|people|portraits?|politicians?|presidents?|ministers?|secretaries|ambassadors?)\b/i,
  /\b(interiors?|rooms?|offices?|gyms?|museums?|tombs?|porch|hotels?)\b/i,
  /\b(birds?|animals?|camels?|deer|horses?|reporters?|delegations?)\b/i,
  /\b(maps?|diagrams?|collages?|montages?|selfies?|headshots?)\b/i
];

const difficultyById = locationDifficultyMap(builtInLocations);
const stats = new Map<string, { total: number; base: number; curated: number; easy: number; medium: number; hard: number }>();
const errors: string[] = [];

for (const location of builtInLocations) {
  const row = stats.get(location.category) ?? { total: 0, base: 0, curated: 0, easy: 0, medium: 0, hard: 0 };
  row.total += 1;
  if (location.catalogVariant === "curated-image") row.curated += 1;
  else row.base += 1;
  const difficulty = difficultyById.get(location.id);
  if (difficulty) row[difficulty] += 1;
  stats.set(location.category, row);

  if (location.catalogVariant === "nearby-image") errors.push(`${location.id}: ungeprüfte Radiusvariante ist spielbar`);
  if (location.catalogVariant === "curated-image") {
    if (location.imageReviewStatus !== "approved") errors.push(`${location.id}: kuratierte Variante ist nicht freigegeben`);
    if (!location.imageQualityScore || location.imageQualityScore < 7) errors.push(`${location.id}: Qualitätswert fehlt oder ist zu niedrig`);
    if (prohibitedCuratedFilePatterns.some((pattern) => pattern.test(location.imageFile ?? ""))) {
      errors.push(`${location.id}: gesperrtes Motiv im Dateinamen ${location.imageFile}`);
    }
  }
}

console.table(Object.fromEntries(stats));
console.log(`Aktiver Katalog: ${builtInLocations.length} Bilder`);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Katalog-Audit bestanden: keine ungeprüften Radiusvarianten oder gesperrten kuratierten Motive aktiv.");
}
