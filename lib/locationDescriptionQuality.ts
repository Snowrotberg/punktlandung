import { locationDescriptionMaximumLength } from "@/lib/locationDescription";
import type { GeoLocation } from "@/types/game";

export type LocationDescriptionIssue =
  | "missing-description"
  | "missing-provenance"
  | "overlong"
  | "sentence-fragment"
  | "artificial-ellipsis"
  | "generic-filler";

const genericFillerPattern = /\b(?:eines der bekanntesten|bekannt(?:e[snr]?)? wahrzeichen|beliebtes reiseziel|touristenattraktion|liegt in diesem land)\b/i;
const allowedSourceHosts = new Set(["commons.wikimedia.org", "de.wikipedia.org", "en.wikipedia.org", "www.wikidata.org"]);

function balancedParentheses(value: string): boolean {
  let depth = 0;
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

export function locationDescriptionIssues(
  location: Pick<GeoLocation, "shortDescription" | "descriptionSourceUrl">
): LocationDescriptionIssue[] {
  const description = location.shortDescription?.trim() ?? "";
  const issues: LocationDescriptionIssue[] = [];
  if (!description) issues.push("missing-description");
  if (!location.descriptionSourceUrl) {
    issues.push("missing-provenance");
  } else {
    try {
      if (!allowedSourceHosts.has(new URL(location.descriptionSourceUrl).hostname)) issues.push("missing-provenance");
    } catch {
      issues.push("missing-provenance");
    }
  }
  if (description.length > locationDescriptionMaximumLength) issues.push("overlong");
  if (
    description
    && (!balancedParentheses(description)
      || /^(?:Chr\. von|Jahrhundert zurückreichende)\b/i.test(description)
      || /\b(?:bzw|ca|sg)\.$/i.test(description))
  ) issues.push("sentence-fragment");
  if (/…$/.test(description)) issues.push("artificial-ellipsis");
  if (genericFillerPattern.test(description)) issues.push("generic-filler");
  return issues;
}

export function locationDescriptionCatalogFingerprint(locations: readonly GeoLocation[]): string {
  const rows = locations
    .map((location) => [location.id, location.shortDescription ?? "", location.descriptionSourceUrl ?? ""].join("|"))
    .sort()
    .join("\n");
  let hash = 0x811c9dc5;
  for (let index = 0; index < rows.length; index += 1) {
    hash ^= rows.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
