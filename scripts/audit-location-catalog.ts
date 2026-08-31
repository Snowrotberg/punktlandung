import { builtInLocations, catalogInventoryLocations } from "../data/locations";
import { locationDifficultyMap } from "../lib/locationDifficulty";
import { catalogImageIssues } from "../lib/catalogImageQuality";
import { buildCatalogStatistics } from "../lib/catalogStatistics";
import landscapeContextReviewJson from "../data/generated/landscape-context-review.generated.json";
import { assessLandscapeContext, landscapeContextCatalogFingerprint } from "../lib/landscapeImageQuality";
import licenseCatalogJson from "../data/generated/image-licenses.generated.json";
import {
  imageFileNameForLicense,
  imageLicenseCatalogFileName,
  imageLicenseEntryMatchesFile,
  normalizeImageLicenseFileName,
  type ImageLicenseEntryFileNames
} from "../lib/imageLicenseLink";

type AuditedLicenseEntry = ImageLicenseEntryFileNames & {
  availability?: "available" | "unavailable";
  unavailableReason?: string;
  artist: string | null;
  license: string | null;
  licenseUrl: string | null;
  sourceUrl: string;
};

const licenseCatalog = licenseCatalogJson as unknown as {
  rawCatalogFileCount?: number;
  imageCount: number;
  unavailableImageCount?: number;
  entries: AuditedLicenseEntry[];
};

const prohibitedCuratedFilePatterns = [
  /\b(person|people|portraits?|politicians?|presidents?|ministers?|secretaries|ambassadors?)\b/i,
  /\b(interiors?|rooms?|offices?|gyms?|museums?|tombs?|porch|hotels?)\b/i,
  /\b(birds?|animals?|camels?|deer|horses?|reporters?|delegations?)\b/i,
  /\b(maps?|diagrams?|collages?|montages?|selfies?|headshots?)\b/i
];

const difficultyById = locationDifficultyMap(builtInLocations);
const stats = new Map<string, { total: number; base: number; curated: number; easy: number; medium: number; hard: number }>();
const errors: string[] = [];
const catalogStatistics = buildCatalogStatistics(builtInLocations, catalogInventoryLocations);
const landscapeContextAssessments = catalogInventoryLocations
  .filter((location) => location.category === "landscapes" && catalogImageIssues(location).every((issue) => issue === "context-unusable"))
  .map(assessLandscapeContext)
  .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
const activeLandscapeIds = new Set(builtInLocations.filter((location) => location.category === "landscapes").map((location) => location.id));

for (const location of builtInLocations) {
  const row = stats.get(location.category) ?? { total: 0, base: 0, curated: 0, easy: 0, medium: 0, hard: 0 };
  row.total += 1;
  if (location.catalogVariant === "curated-image") row.curated += 1;
  else row.base += 1;
  const difficulty = difficultyById.get(location.id);
  if (difficulty) row[difficulty] += 1;
  stats.set(location.category, row);

  if (location.catalogVariant === "nearby-image") errors.push(`${location.id}: ungeprüfte Radiusvariante ist spielbar`);
  const qualityIssues = catalogImageIssues(location);
  if (qualityIssues.length > 0) errors.push(`${location.id}: aktives Bild verletzt Qualitätsprofil (${qualityIssues.join(", ")})`);
  if (location.catalogVariant === "curated-image") {
    if (location.imageReviewStatus !== "approved") errors.push(`${location.id}: kuratierte Variante ist nicht freigegeben`);
    if (!location.imageQualityScore || location.imageQualityScore < 7) errors.push(`${location.id}: Qualitätswert fehlt oder ist zu niedrig`);
    if (prohibitedCuratedFilePatterns.some((pattern) => pattern.test(location.imageFile ?? ""))) {
      errors.push(`${location.id}: gesperrtes Motiv im Dateinamen ${location.imageFile}`);
    }
  }
}

if (catalogStatistics.missingLicenseImages > 0) {
  errors.push(`${catalogStatistics.missingLicenseImages} aktive Bilddateien haben keinen vollständigen Lizenzeintrag`);
}
if (catalogStatistics.missingInventoryLicenseImages > 0) {
  errors.push(`${catalogStatistics.missingInventoryLicenseImages} aktive oder historische Bilddateien haben keinen Lizenzeintrag mit Originalquelle`);
}

const activeImageFiles = new Set(builtInLocations
  .filter((location) => location.source === "wikimedia")
  .map(imageFileNameForLicense)
  .filter((fileName): fileName is string => Boolean(fileName)));
const inventoryImageFiles = new Set(catalogInventoryLocations
  .filter((location) => location.source === "wikimedia")
  .map(imageFileNameForLicense)
  .filter((fileName): fileName is string => Boolean(fileName)));
const normalizedInventoryImageFiles = new Set([...inventoryImageFiles].map(normalizeImageLicenseFileName));
const missingInventoryAliases = [...inventoryImageFiles].filter((fileName) =>
  !licenseCatalog.entries.some((entry) => imageLicenseEntryMatchesFile(entry, fileName))
);
if (missingInventoryAliases.length > 0) {
  errors.push(`${missingInventoryAliases.length} exakte Katalogdateinamen sind weder als Eintrag noch als Alias erhalten`);
}
const normalizedEntryNames = licenseCatalog.entries.map((entry) =>
  normalizeImageLicenseFileName(imageLicenseCatalogFileName(entry))
);
if (new Set(normalizedEntryNames).size !== normalizedEntryNames.length) {
  errors.push(`${normalizedEntryNames.length - new Set(normalizedEntryNames).size} normalisiert doppelte Lizenzeinträge sind nicht bereinigt`);
}
if (licenseCatalog.imageCount !== licenseCatalog.entries.length || licenseCatalog.entries.length !== normalizedInventoryImageFiles.size) {
  errors.push(`Lizenzkatalog-Zählung inkonsistent: imageCount=${licenseCatalog.imageCount}, Einträge=${licenseCatalog.entries.length}, normalisierte Inventardateien=${normalizedInventoryImageFiles.size}`);
}
if (licenseCatalog.rawCatalogFileCount !== inventoryImageFiles.size) {
  errors.push(`Rohdatei-Zählung inkonsistent: JSON=${licenseCatalog.rawCatalogFileCount ?? "fehlt"}, Inventar=${inventoryImageFiles.size}`);
}
const incompleteEntries = licenseCatalog.entries.filter((entry) =>
  entry.availability !== "unavailable" && (!entry.artist || !entry.license || !entry.sourceUrl || entry.artist === "Nicht angegeben" || entry.license === "Nicht angegeben")
);
if (incompleteEntries.length > 0) {
  errors.push(`${incompleteEntries.length} verfügbare Lizenzeinträge haben unvollständige Urheber-, Lizenz- oder Quellenangaben`);
}
const unavailableEntries = licenseCatalog.entries.filter((entry) => entry.availability === "unavailable");
if (unavailableEntries.some((entry) => !entry.unavailableReason || !entry.sourceUrl)) {
  errors.push("Mindestens eine nicht mehr verfügbare Commons-Datei hat keinen belegten Grund oder Protokolllink");
}
if (unavailableEntries.some((entry) => [...activeImageFiles].some((fileName) => imageLicenseEntryMatchesFile(entry, fileName)))) {
  errors.push("Mindestens eine aktuell spielbare Datei ist bei Commons als nicht mehr verfügbar dokumentiert");
}
if ((licenseCatalog.unavailableImageCount ?? 0) !== unavailableEntries.length) {
  errors.push(`Nicht-verfügbar-Zählung inkonsistent: JSON=${licenseCatalog.unavailableImageCount ?? "fehlt"}, Einträge=${unavailableEntries.length}`);
}
if (landscapeContextReviewJson.catalogFingerprint !== landscapeContextCatalogFingerprint(landscapeContextAssessments)) {
  errors.push("Landschafts-Review ist veraltet; npm run catalog:audit-landscapes ausführen");
}
if (landscapeContextReviewJson.checkedImageCount !== landscapeContextAssessments.length) {
  errors.push(`Landschafts-Review deckt ${landscapeContextReviewJson.checkedImageCount} statt ${landscapeContextAssessments.length} technisch geeigneten Motiven ab`);
}
const automaticallyFlaggedLandscapes = landscapeContextAssessments.filter((entry) => entry.automaticReviewRequired);
const visuallyReviewedLandscapes = landscapeContextAssessments.filter((entry) => entry.visualDecision !== null);
const pendingVisualReviewLandscapes = automaticallyFlaggedLandscapes.filter((entry) => entry.visualDecision === null);
if (landscapeContextReviewJson.automaticallyFlaggedImageCount !== automaticallyFlaggedLandscapes.length) {
  errors.push("Automatisch markierte Landschaftszahl ist im generierten Review veraltet");
}
if (landscapeContextReviewJson.visuallyReviewedImageCount !== visuallyReviewedLandscapes.length) {
  errors.push("Visuell entschiedene Landschaftszahl ist im generierten Review veraltet");
}
if (landscapeContextReviewJson.pendingVisualReviewCount !== pendingVisualReviewLandscapes.length) {
  errors.push("Offene visuelle Landschaftsprüfungen sind im generierten Review veraltet");
}
if (pendingVisualReviewLandscapes.length > 0) {
  errors.push(`${pendingVisualReviewLandscapes.length} automatisch markierte Landschaftsmotive haben noch keine visuelle Entscheidung`);
}
if (landscapeContextAssessments.some((entry) => entry.status === "excluded" && activeLandscapeIds.has(entry.locationId))) {
  errors.push("Mindestens ein als kontextlos quarantänisiertes Landschaftsbild ist weiterhin aktiv");
}

console.table(Object.fromEntries(stats));
console.log(`Katalogbestand: ${catalogInventoryLocations.length} geprüfte Quellen, ${builtInLocations.length} aktive Bilder, ${catalogInventoryLocations.length - builtInLocations.length} Qualitätsausschlüsse`);
console.log(
  `Landschaftskontext: ${landscapeContextReviewJson.checkedImageCount} technisch geprüft, `
  + `${landscapeContextReviewJson.automaticallyFlaggedImageCount} automatisch markiert, `
  + `${landscapeContextReviewJson.visuallyReviewedImageCount} visuell entschieden, `
  + `${landscapeContextReviewJson.pendingVisualReviewCount} offen, `
  + `${landscapeContextReviewJson.excludedImageCount} quarantänisiert`
);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Katalog-Audit bestanden: Alle aktiven Bilder erfüllen Kategorie-, Aktualitäts-, Format- und TV-Qualitätsprofil.");
}
