import { writeFile } from "node:fs/promises";
import path from "node:path";
import { builtInLocations } from "../data/locations";
import {
  locationDescriptionCatalogFingerprint,
  locationDescriptionIssues
} from "../lib/locationDescriptionQuality";

async function main() {
  const entries = builtInLocations.flatMap((location) => {
    const issues = locationDescriptionIssues(location);
    return issues.length > 0 ? [{
      locationId: location.id,
      title: location.title,
      category: location.category,
      descriptionLength: location.shortDescription?.length ?? 0,
      descriptionSourceUrl: location.descriptionSourceUrl ?? null,
      issues
    }] : [];
  });
  const sourceHosts = Object.fromEntries([...new Set(builtInLocations.map((location) =>
    new URL(location.descriptionSourceUrl!).hostname
  ))].sort().map((host) => [host, builtInLocations.filter((location) =>
    new URL(location.descriptionSourceUrl!).hostname === host
  ).length]));
  const output = {
    catalogFingerprint: locationDescriptionCatalogFingerprint(builtInLocations),
    activeLocationCount: builtInLocations.length,
    completeDescriptionCount: builtInLocations.length - entries.filter((entry) => entry.issues.includes("missing-description")).length,
    completeProvenanceCount: builtInLocations.length - entries.filter((entry) => entry.issues.includes("missing-provenance")).length,
    violationCount: entries.length,
    sourceHosts,
    entries
  };
  const outputPath = path.join(process.cwd(), "data", "generated", "location-description-audit.generated.json");
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `Zielinfos geprüft: ${output.activeLocationCount} aktiv, ${output.completeDescriptionCount} mit Kurzinfo, `
    + `${output.completeProvenanceCount} mit Provenienz, ${output.violationCount} Verstöße.`
  );
  if (entries.length > 0) process.exitCode = 2;
}

void main();
